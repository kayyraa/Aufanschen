const TypeList = document.querySelector(".TypeList");
const Selector = document.querySelector(".Selector");
const Canvas = document.querySelector(".Canvas");
const Gl = Canvas.getContext("webgl2", {
    antialias: true,
    alpha: false,
    desynchronized: true,
    powerPreference: "high-performance"
});
const Dpr = Math.min(window.devicePixelRatio || 1, 2);
Canvas.width = window.innerWidth * Dpr;
Canvas.height = window.innerHeight * Dpr;
Canvas.style.width = window.innerWidth + "px";
Canvas.style.height = window.innerHeight + "px";

const ElementsByName = new Map();
for (const El of Elements) ElementsByName.set(El.Name, El);

// Pre-parse element colors once instead of re-parsing every frame.
const ColorCache = new Map();
function GetRgba(ColorString) {
    let Cached = ColorCache.get(ColorString);
    if (Cached) return Cached;
    const Match = ColorString.match(/\d+(\.\d+)?/g).map(Number);
    Cached = [Match[0], Match[1], Match[2], Match[3] !== undefined ? Match[3] : 1];
    ColorCache.set(ColorString, Cached);
    return Cached;
}

const Simulation = {
    Timescale: 1,
    Pixel: 8,
    ShowPressure: false,
    // Pressure field tuning (TPT-like)
    PressureDiffusion: 0.9,   // how much pressure blurs into neighbors each step (0-1)
    PressureDecay: 0.98,      // pressure fades over time
    PressureAdvect: 0.15      // how strongly pressure gradient pushes fluids/gases (kept modest so it nudges flow instead of overpowering it)
};

const Particles = [];
const Mouse = [0, 0, 0, 0, 1, false];

let Selected = "DUST";

const UpdateInterval = 125;
let LastTime = performance.now();
let RefreshRate = 60;
let FrameCount = 0;
let Framerate = 0;

let Program;
let Locations;
let Vao;
let InstanceBuffer;

const VertexShaderSource = `#version 300 es
in vec2 aPosition;
in vec2 aTranslation;
in float aSize;
in vec4 aColor;
uniform mat4 uProjection;
out vec4 vColor;
void main() {
    gl_Position = uProjection * vec4(aPosition * aSize + aTranslation, 0.0, 1.0);
    vColor = aColor;
}`;

const FragmentShaderSource = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main() {
    fragColor = vColor;
}`;

function CompileShader(Gl, Type, Source) {
    const Shader = Gl.createShader(Type);
    Gl.shaderSource(Shader, Source);
    Gl.compileShader(Shader);
    if (!Gl.getShaderParameter(Shader, Gl.COMPILE_STATUS)) {
        console.error(Gl.getShaderInfoLog(Shader));
        Gl.deleteShader(Shader);
        return null;
    }
    return Shader;
}

function CreateProgram(Gl, VertexSrc, FragmentSrc) {
    const VertexShader = CompileShader(Gl, Gl.VERTEX_SHADER, VertexSrc);
    const FragmentShader = CompileShader(Gl, Gl.FRAGMENT_SHADER, FragmentSrc);
    const Program = Gl.createProgram();
    Gl.attachShader(Program, VertexShader);
    Gl.attachShader(Program, FragmentShader);
    Gl.linkProgram(Program);
    if (!Gl.getProgramParameter(Program, Gl.LINK_STATUS)) {
        console.error(Gl.getProgramInfoLog(Program));
        return null;
    }
    return Program;
}

function InitWebGL() {
    Program = CreateProgram(Gl, VertexShaderSource, FragmentShaderSource);
    Locations = {
        Position: Gl.getAttribLocation(Program, "aPosition"),
        Translation: Gl.getAttribLocation(Program, "aTranslation"),
        Size: Gl.getAttribLocation(Program, "aSize"),
        Color: Gl.getAttribLocation(Program, "aColor"),
        Projection: Gl.getUniformLocation(Program, "uProjection")
    };

    const QuadVertices = new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 1
    ]);
    const QuadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const PositionBuffer = Gl.createBuffer();
    Gl.bindBuffer(Gl.ARRAY_BUFFER, PositionBuffer);
    Gl.bufferData(Gl.ARRAY_BUFFER, QuadVertices, Gl.STATIC_DRAW);

    const IndexBuffer = Gl.createBuffer();
    Gl.bindBuffer(Gl.ELEMENT_ARRAY_BUFFER, IndexBuffer);
    Gl.bufferData(Gl.ELEMENT_ARRAY_BUFFER, QuadIndices, Gl.STATIC_DRAW);

    InstanceBuffer = Gl.createBuffer();

    Vao = Gl.createVertexArray();
    Gl.bindVertexArray(Vao);

    Gl.bindBuffer(Gl.ELEMENT_ARRAY_BUFFER, IndexBuffer);

    Gl.bindBuffer(Gl.ARRAY_BUFFER, PositionBuffer);
    Gl.enableVertexAttribArray(Locations.Position);
    Gl.vertexAttribPointer(Locations.Position, 2, Gl.FLOAT, false, 0, 0);

    Gl.bindBuffer(Gl.ARRAY_BUFFER, InstanceBuffer);
    Gl.enableVertexAttribArray(Locations.Translation);
    Gl.vertexAttribPointer(Locations.Translation, 2, Gl.FLOAT, false, 28, 0);
    Gl.vertexAttribDivisor(Locations.Translation, 1);

    Gl.enableVertexAttribArray(Locations.Size);
    Gl.vertexAttribPointer(Locations.Size, 1, Gl.FLOAT, false, 28, 8);
    Gl.vertexAttribDivisor(Locations.Size, 1);

    Gl.enableVertexAttribArray(Locations.Color);
    Gl.vertexAttribPointer(Locations.Color, 4, Gl.FLOAT, false, 28, 12);
    Gl.vertexAttribDivisor(Locations.Color, 1);

    Gl.bindVertexArray(null);
}

// Reusable scratch buffer for instance data so we don't allocate a new
// Float32Array every single draw call every frame.
let InstanceScratch = new Float32Array(0);
function EnsureScratch(Count) {
    const Needed = Count * 7;
    if (InstanceScratch.length < Needed) {
        InstanceScratch = new Float32Array(Needed);
    }
    return InstanceScratch;
}

function DrawRectArray(Gl, Rects, Count) {
    if (Count === 0) return;
    const InstanceData = EnsureScratch(Count);
    for (let I = 0; I < Count; I++) {
        const Off = I * 7;
        InstanceData[Off] = Rects[I].X;
        InstanceData[Off + 1] = Rects[I].Y;
        InstanceData[Off + 2] = Rects[I].Size;
        InstanceData[Off + 3] = Rects[I].R / 255;
        InstanceData[Off + 4] = Rects[I].G / 255;
        InstanceData[Off + 5] = Rects[I].B / 255;
        InstanceData[Off + 6] = Rects[I].A;
    }
    Gl.bindBuffer(Gl.ARRAY_BUFFER, InstanceBuffer);
    Gl.bufferData(Gl.ARRAY_BUFFER, InstanceData.subarray(0, Count * 7), Gl.DYNAMIC_DRAW);
    Gl.drawElementsInstanced(Gl.TRIANGLES, 6, Gl.UNSIGNED_SHORT, 0, Count);
}

Types.forEach((Type, Index) => {
    const TypeName = Type[0];
    const TypeIcon = Type[1];

    const TypeElement = document.createElement("div");
    TypeElement.classList.add(TypeName);
    TypeElement.style.setProperty("--Delay", `${Index * 0.0625}s`);
    TypeList.appendChild(TypeElement);

    const TypeIconElement = document.createElement("img");
    TypeIconElement.src = TypeIcon;
    TypeElement.appendChild(TypeIconElement);

    const TypeNameElement = document.createElement("span");
    TypeNameElement.innerHTML = TypeName.replace("None", "Special");
    TypeElement.appendChild(TypeNameElement);

    ["mouseenter", "click"].forEach(Event => {
        TypeElement.addEventListener(Event, () => {
            Selector.querySelector(`.${TypeName}`).style.display = "flex";
            Selector.querySelector(`.${TypeName}`).style.opacity = "1";
            TypeElement.style.backgroundColor = "white";
            TypeElement.querySelector("img").style.filter = "invert(100%) brightness(0%)";

            Array.from(Selector.children).forEach(OtherSelector => {
                if (!OtherSelector.classList.contains(TypeName)) OtherSelector.style.display = "";
            });

            Array.from(TypeList.children).forEach(OtherType => {
                if (OtherType !== TypeElement) {
                    OtherType.style.backgroundColor = "";
                    OtherType.querySelector("img").style.filter = "";
                }
            });
        });
    });
});

Elements.forEach(Element => {
    const ElementDiv = document.createElement("div");
    ElementDiv.innerHTML = Element.Icon ? `<img src="${Element.Icon}">` : String(Element.Name).toUpperCase();
    ElementDiv.style.backgroundColor = Element.Color;
    const [Cr, Cg, Cb] = Element.Color.match(/\d+/g).map(Number);
    (0.299 * Cr + 0.587 * Cg + 0.114 * Cb) / 255 < 0.25 ? ElementDiv.style.color = "rgb(255, 255, 255)" : ElementDiv.style.color = "rgb(0, 0, 0)";

    if (Selector.querySelector(`.${String(Element.Type.includes(",") && Element.Type.includes("Gas") ? Element.Type.split(",")[1] : Element.Type).trim()}`)) {
        Selector.querySelector(
            `.${String(Element.Type.includes(",") && Element.Type.includes("Gas") ? Element.Type.split(",")[1] : Element.Type).trim()}`
        ).appendChild(ElementDiv);
        ElementDiv.addEventListener("click", () => Selected = Element.Name);
    }
});

document.addEventListener("mousemove", Event => {
    Mouse[0] = Event.clientX;
    Mouse[1] = Event.clientY;
});

document.addEventListener("mousedown", Event => {
    Mouse[5] = Event.button === 2 ? 1 : true
});
document.addEventListener("mouseup", () => Mouse[5] = false);

document.addEventListener("wheel", (Event) => {
    Event.preventDefault();
    if (!Event.ctrlKey) {
        Mouse[4] = Clamp(Mouse[4] + (Event.deltaY < 0 ? 1 : -1), 1, 8);
        return;
    }
    const Delta = Event.deltaY < 0 ? 0.25 : -0.25;
    Simulation.Timescale = Math.min(4, Math.max(0.25, Simulation.Timescale + Delta));
}, { passive: false });

document.addEventListener("keydown", Event => {
    if (Event.key === " ") Simulation.Timescale = Simulation.Timescale === 0 ? 1 : 0;
    if (Event.code === "Digit2") Simulation.ShowPressure = !Simulation.ShowPressure;
});

async function GetRefreshRate() {
    return new Promise(Resolve => {
        let Frames = [];
        function Check(Time) {
            Frames.push(Time);
            if (Frames.length < 30) requestAnimationFrame(Check);
            else {
                const Difference = [];
                for (let _ = 1; _ < Frames.length; _++) Difference.push(Frames[_] - Frames[_ - 1]);
                Resolve(Math.round(1000 / (Difference.reduce((Na, Nb) => Na + Nb) / Difference.length)));
            }
        }
        requestAnimationFrame(Check);
    });
}

(async () => {
    RefreshRate = await GetRefreshRate();
})();

// ---------------------------------------------------------------------
// Spatial grid: integer-keyed instead of string-keyed. Cells are
// Pixel-sized, and the key is a single integer packed from (Cx, Cy)
// cell coordinates, which is much cheaper to hash/compare than strings.
// ---------------------------------------------------------------------
const GRID_STRIDE = 8192; // supports coordinates up to +/-4096 cells safely
function CellKey(PxCoord, PyCoord, Pixel) {
    const Cx = (PxCoord / Pixel) | 0;
    const Cy = (PyCoord / Pixel) | 0;
    return (Cy + 4096) * GRID_STRIDE + (Cx + 4096);
}

let Grid = new Map();
function RebuildGrid() {
    Grid = new Map();
    for (const Part of Particles) {
        Grid.set(CellKey(Part.Position[0], Part.Position[1], Simulation.Pixel), Part);
    }
}
RebuildGrid();

// ---------------------------------------------------------------------
// Pressure field: a real diffusing/decaying scalar grid, TPT-style.
// Coarser resolution than the particle grid (PressureCell = Pixel * 4).
// Each step: particles deposit pressure into their cell -> field
// diffuses into neighbors -> field decays. Fluids/gases read the local
// gradient as a push force instead of a crude left/right tie-break.
// ---------------------------------------------------------------------
class PressureField {
    constructor(CellSize) {
        this.CellSize = CellSize;
        this.W = 0;
        this.H = 0;
        this.OriginX = 0;
        this.OriginY = 0;
        this.Data = new Float32Array(0);
        this.Scratch = new Float32Array(0);
        this.Resize();
    }

    Resize() {
        const Cell = this.CellSize;
        const NewW = Math.ceil(window.innerWidth / Cell) + 2;
        const NewH = Math.ceil(window.innerHeight / Cell) + 2;
        if (NewW === this.W && NewH === this.H) return;
        this.W = NewW;
        this.H = NewH;
        this.Data = new Float32Array(this.W * this.H);
        this.Scratch = new Float32Array(this.W * this.H);
    }

    Index(Wx, Wy) {
        const Cx = (Wx / this.CellSize) | 0;
        const Cy = (Wy / this.CellSize) | 0;
        if (Cx < 0 || Cy < 0 || Cx >= this.W || Cy >= this.H) return -1;
        return Cy * this.W + Cx;
    }

    Get(Wx, Wy) {
        const I = this.Index(Wx, Wy);
        return I === -1 ? 0 : this.Data[I];
    }

    Add(Wx, Wy, Amount) {
        const I = this.Index(Wx, Wy);
        if (I !== -1) {
            // Clamp so a burst (or any edge case) can never push a cell's
            // pressure to a magnitude that dominates gradient sampling
            // and effectively freezes particles in place.
            this.Data[I] = Math.max(-64, Math.min(64, this.Data[I] + Amount));
        }
    }

    // Gradient pointing away from high pressure (push direction), sampled
    // at 1-cell offsets. Returns [Fx, Fy].
    Gradient(Wx, Wy) {
        const Cell = this.CellSize;
        const Left = this.Get(Wx - Cell, Wy);
        const Right = this.Get(Wx + Cell, Wy);
        const Up = this.Get(Wx, Wy - Cell);
        const Down = this.Get(Wx, Wy + Cell);
        return [(Left - Right) * 0.5, (Up - Down) * 0.5];
    }

    Step(Diffusion, Decay) {
        this.Resize();
        const W = this.W, H = this.H;
        const Src = this.Data, Dst = this.Scratch;
        for (let Y = 0; Y < H; Y++) {
            const RowUp = Y > 0 ? (Y - 1) * W : -1;
            const RowDown = Y < H - 1 ? (Y + 1) * W : -1;
            const Row = Y * W;
            for (let X = 0; X < W; X++) {
                const Center = Src[Row + X];
                let Neighbors = 0;
                let NeighborCount = 0;
                if (X > 0) { Neighbors += Src[Row + X - 1]; NeighborCount++; }
                if (X < W - 1) { Neighbors += Src[Row + X + 1]; NeighborCount++; }
                if (RowUp !== -1) { Neighbors += Src[RowUp + X]; NeighborCount++; }
                if (RowDown !== -1) { Neighbors += Src[RowDown + X]; NeighborCount++; }
                const Avg = NeighborCount > 0 ? Neighbors / NeighborCount : Center;
                const Blended = Center + (Avg - Center) * Diffusion;
                Dst[Row + X] = Blended * Decay;
            }
        }
        this.Data.set(Dst);
    }

    Clear() {
        this.Data.fill(0);
    }
}

const PressureCellSize = Simulation.Pixel * 4;
const Pressure = new PressureField(PressureCellSize);

const Draw = () => {
    Gl.viewport(0, 0, Canvas.width, Canvas.height);
    Gl.clear(Gl.COLOR_BUFFER_BIT);
    Gl.useProgram(Program);

    const ProjectionMatrix = new Float32Array([
        2 / Canvas.width, 0, 0, 0,
        0, -2 / Canvas.height, 0, 0,
        0, 0, 1, 0,
        -1, 1, 0, 1
    ]);
    Gl.uniformMatrix4fv(Locations.Projection, false, ProjectionMatrix);

    Gl.enable(Gl.BLEND);
    Gl.blendFunc(Gl.SRC_ALPHA, Gl.ONE_MINUS_SRC_ALPHA);
    Gl.bindVertexArray(Vao);

    // Pressure overlay, drawn straight from the field (no Map iteration).
    let PressureCount = 0;
    let PressureRects = null;
    if (Simulation.ShowPressure) {
        PressureRects = [];
        const Cell = Pressure.CellSize;
        for (let Y = 0; Y < Pressure.H; Y++) {
            for (let X = 0; X < Pressure.W; X++) {
                const Value = Pressure.Data[Y * Pressure.W + X];
                if (Value <= 0.05) continue;
                const Positive = Value >= 0;
                const Alpha = Math.min(1, Math.abs(Value) / 16) * 0.35;
                PressureRects.push({
                    X: X * Cell,
                    Y: Y * Cell,
                    Size: Cell,
                    R: Positive ? 0 : 255,
                    G: Positive ? 120 : 60,
                    B: Positive ? 255 : 60,
                    A: Alpha
                });
                PressureCount++;
            }
        }
    }

    const GlowRects = [];
    let GlowCount = 0;
    for (const Particle of Particles) {
        const Rings = Math.floor(Math.min(1, Math.abs(Particle.Temperature / Particle.Melt)) * 2);
        if (Rings <= 0) continue;
        const Arr = GetRgba(Particle.Color);
        for (let R = 1; R <= Rings; R++) {
            const Size = Simulation.Pixel + (R * Simulation.Pixel * 2);
            const Offset = (Size - Simulation.Pixel) / 2;
            GlowRects.push({
                X: Particle.Position[0] - Offset,
                Y: Particle.Position[1] - Offset,
                Size: Size,
                R: Arr[0],
                G: Arr[1],
                B: Arr[2],
                A: 0.0125
            });
            GlowCount++;
        }
    }

    const ParticleCount = Particles.length;
    const ParticleRects = new Array(ParticleCount);
    for (let I = 0; I < ParticleCount; I++) {
        const Particle = Particles[I];
        const Element = ElementsByName.get(Particle.Name);
        const Arr = GetRgba(Particle.Color);
        const TempDiff = Particle.Temperature - (Element ? Element.Temperature : 22) || 22;
        const Value = Math.max(Arr[0] / 4, Arr[0] + TempDiff);
        const Red = Math.min(255, Math.max(0, Value));
        ParticleRects[I] = {
            X: Particle.Position[0],
            Y: Particle.Position[1],
            Size: Simulation.Pixel,
            R: Red,
            G: Arr[1],
            B: Arr[2],
            A: 1
        };
    }

    if (PressureRects) DrawRectArray(Gl, PressureRects, PressureCount);
    DrawRectArray(Gl, GlowRects, GlowCount);
    DrawRectArray(Gl, ParticleRects, ParticleCount);

    Gl.bindVertexArray(null);
};

const Simulate = () => {
    if (!Simulation.Accumulator) Simulation.Accumulator = 0;
    Simulation.Accumulator += Simulation.Timescale;
    const TotalSteps = Math.floor(Simulation.Accumulator);
    Simulation.Accumulator -= TotalSteps;

    const Pixel = Simulation.Pixel;

    for (let Step = 0; Step < TotalSteps; Step++) {
        // --- Pressure: deposit from particles, then diffuse/decay -----
        // Instead of rebuilding the whole field from a full particle scan
        // every step (like the old Map-rebuild), we still deposit fresh
        // each step (cheap, one add per particle) but the FIELD ITSELF
        // persists and diffuses, which is what gives propagating waves
        // and directional push instead of a static occupancy count.
        Pressure.Resize();
        // Diffuse + decay the *existing* field first (this is what carries
        // pressure waves outward and lets settled areas relax), THEN
        // deposit this step's occupancy on top. Depositing before decay
        // (the old order) let pressure accumulate without bound in any
        // spot that stayed occupied, which is what caused particles to
        // seize up as if hitting an invisible wall.
        Pressure.Step(Simulation.PressureDiffusion, Simulation.PressureDecay);
        for (const Part of Particles) {
            if (Part.Type.includes("Solid")) continue;
            Pressure.Add(Part.Position[0], Part.Position[1], 1);
        }

        const HasPart = (Px, Py) => Grid.has(CellKey(Px, Py, Pixel));
        const Move = (Part, Nx, Ny) => {
            Grid.delete(CellKey(Part.Position[0], Part.Position[1], Pixel));
            Part.Position[0] = Nx;
            Part.Position[1] = Ny;
            Grid.set(CellKey(Nx, Ny, Pixel), Part);
        };

        // --- Crumble (solids breaking under fluid pressure) -----------
        const CrumbleActions = [];
        for (const Part of Particles) {
            if (!Part.Type.includes("Solid") || !Part.CrumblePressure) continue;
            const FluidPressure = Pressure.Get(Part.Position[0], Part.Position[1]);
            if (FluidPressure >= Part.CrumblePressure[0]) {
                const BrokenElement = ElementsByName.get(Part.CrumblePressure[1]);
                if (BrokenElement) {
                    CrumbleActions.push({
                        Old: Part,
                        New: {
                            ...BrokenElement,
                            Position: [Part.Position[0], Part.Position[1]],
                            Temperature: BrokenElement.Temperature || 22,
                            Color: PowderEffect(BrokenElement.Color, 16)
                        }
                    });
                }
            }
        }

        for (const Action of CrumbleActions) {
            const Index = Particles.indexOf(Action.Old);
            if (Index !== -1) {
                Particles.splice(Index, 1);
                Grid.delete(CellKey(Action.Old.Position[0], Action.Old.Position[1], Pixel));
                Particles.push(Action.New);
                Grid.set(CellKey(Action.New.Position[0], Action.New.Position[1], Pixel), Action.New);
                Pressure.Add(Action.New.Position[0], Action.New.Position[1], 1);
            }
        }

        const ToRemove = new Set();
        for (let Index0 = 0; Index0 < Particles.length; Index0++) {
            const Part0 = Particles[Index0];
            if (ToRemove.has(Part0)) continue;

            if (Part0.Temperature > Part0.Melt) Part0.Type = Part0.Molten;
            if (Part0.Freeze && Part0.Temperature < Part0.Freeze) {
                if (Part0.Cold.startsWith("&")) {
                    const Template = ElementsByName.get(Part0.Cold.split("&")[1]);
                    const SavedPosition = Part0.Position;
                    Object.assign(Part0, Template);
                    Part0.Color = PowderEffect(Part0.Color, 16);
                    Part0.Position = SavedPosition;
                } else Part0.Type = Part0.Cold;
            }

            if (Part0.Temperature > 22) Part0.Temperature -= 0.0625;

            const Px = Part0.Position[0];
            const Py = Part0.Position[1];

            for (const [Ox, Oy] of [[0, Pixel], [0, -Pixel], [Pixel, 0], [-Pixel, 0]]) {
                const Part1 = Grid.get(CellKey(Px + Ox, Py + Oy, Pixel));
                if (!Part1 || ToRemove.has(Part1)) continue;

                if (Math.abs(Part0.Temperature - Part1.Temperature) >= 0.25) {
                    const Average = (Part0.Temperature + Part1.Temperature) / 2;
                    Part0.Temperature = Average;
                    Part1.Temperature = Average;
                }

                if (Part0.Reactive && Part0.Reactive[1].includes(Part1.Name)) {
                    const Energy = Part0.Reactive[0];
                    Part0.Temperature += Energy;
                    Part1.Temperature += Energy;

                    const Threshold = Math.max(0, 120 - Energy);

                    const VaporizeRoll = Math.floor(Math.random() * 100);
                    if (VaporizeRoll >= Threshold) {
                        const TargetRoll = Math.floor(Math.random() * 100);
                        const Doomed = TargetRoll >= 50 ? Part0 : Part1;
                        ToRemove.add(Doomed);
                        Grid.delete(CellKey(Doomed.Position[0], Doomed.Position[1], Pixel));
                        // A reaction that destroys matter releases pressure
                        // (a little explosion pulse), TPT-style.
                        Pressure.Add(Doomed.Position[0], Doomed.Position[1], 8);
                        if (Doomed === Part0) break;
                        continue;
                    }

                    const Products = Part0.Reactive[2];
                    if (Products && Products.length > 0) {
                        const ProductRoll = Math.floor(Math.random() * 100);
                        if (ProductRoll >= Threshold) {
                            const Chosen = Products[Math.floor(Math.random() * Products.length)];
                            const Template = ElementsByName.get(Chosen);
                            if (Template) {
                                const Spawn = Object.assign({}, Template);
                                Spawn.Position = [Part0.Position[0], Part0.Position[1]];
                                Spawn.Temperature = Template.Temperature || 22;
                                if (Template.Type.includes("Light")) {
                                    Spawn.Life = typeof Template.Life === "number" ? Template.Life : parseFloat(Template.Life) || 700;
                                    const Angle = Math.random() * Math.PI * 2;
                                    Spawn.Direction = [Math.cos(Angle), Math.sin(Angle)];
                                }
                                Particles.push(Spawn);
                                Grid.set(CellKey(Spawn.Position[0], Spawn.Position[1], Pixel), Spawn);
                            }
                        }
                    }

                    const Amalgamate = Part0.Reactive[3];
                    if (Amalgamate) {
                        Part1.Color = PowderEffect(Part1.Color, 16);
                        Part1.Name = `A${Part1.Name}`;
                        if (!Part1.Type.includes("Liquid") && !Part1.Type.includes("Gas"))
                            Part1.Type = Part1.Type.replace("Solid", "Powder");
                    }
                }
            }

            if (ToRemove.has(Part0)) continue;
            if (Part0.Type.includes("Solid")) continue;

            const Cx = Part0.Position[0];
            const Cy = Part0.Position[1];
            const Ww = window.innerWidth;
            const Wh = window.innerHeight;

            if (Cx < 0 || Cx >= Ww || Cy < 0 || Cy >= Wh) {
                ToRemove.add(Part0);
                Grid.delete(CellKey(Cx, Cy, Pixel));
                continue;
            }

            if (Part0.Type.includes("Powder")) {
                if (Cy < Wh - Pixel) {
                    if (!HasPart(Cx, Cy + Pixel)) Move(Part0, Cx, Cy + Pixel);
                    else {
                        const LeftOpen  = !HasPart(Cx - Pixel, Cy + Pixel) && Cx > 0;
                        const RightOpen = !HasPart(Cx + Pixel, Cy + Pixel) && Cx < Ww - Pixel;
                        if (LeftOpen && RightOpen) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy + Pixel);
                        else if (LeftOpen) Move(Part0, Cx - Pixel, Cy + Pixel);
                        else if (RightOpen) Move(Part0, Cx + Pixel, Cy + Pixel);
                    }
                }
            } else if (Part0.Type.includes("Liquid") || Part0.Type.includes("Gas")) {
                const IsGas = Part0.Type.includes("Gas");
                const VertDir = IsGas ? -Pixel : Pixel;
                const VertOpen = IsGas ? (Cy > 0 && !HasPart(Cx, Cy - Pixel)) : (Cy < Wh - Pixel && !HasPart(Cx, Cy + Pixel));
                const DiagLeftOpen = IsGas
                    ? (Cy > 0 && Cx > 0 && !HasPart(Cx - Pixel, Cy - Pixel))
                    : (Cy < Wh - Pixel && Cx > 0 && !HasPart(Cx - Pixel, Cy + Pixel));
                const DiagRightOpen = IsGas
                    ? (Cy > 0 && Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy - Pixel))
                    : (Cy < Wh - Pixel && Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy + Pixel));
                const LeftOpen  = Cx > 0 && !HasPart(Cx - Pixel, Cy);
                const RightOpen = Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy);

                if (VertOpen) Move(Part0, Cx, Cy + VertDir);
                else if (DiagLeftOpen && DiagRightOpen) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy + VertDir);
                else if (DiagLeftOpen) Move(Part0, Cx - Pixel, Cy + VertDir);
                else if (DiagRightOpen) Move(Part0, Cx + Pixel, Cy + VertDir);
                else if (LeftOpen || RightOpen) {
                    // Real pressure-gradient push instead of a crude
                    // occupancy-count tie-break: sample the diffused
                    // field's gradient and let it bias horizontal flow,
                    // mixed with a little randomness so it doesn't look
                    // robotic.
                    const [Gx] = Pressure.Gradient(Cx, Cy);
                    const Bias = Gx * Simulation.PressureAdvect;
                    let Score = Bias + (Math.random() - 0.5) * 0.5;
                    if (!LeftOpen) Score = 1;
                    else if (!RightOpen) Score = -1;
                    if (Score > 0 && RightOpen) Move(Part0, Cx + Pixel, Cy);
                    else if (Score <= 0 && LeftOpen) Move(Part0, Cx - Pixel, Cy);
                    else if (RightOpen) Move(Part0, Cx + Pixel, Cy);
                    else if (LeftOpen) Move(Part0, Cx - Pixel, Cy);
                }
            } else if (Part0.Type.includes("Light")) {
                Part0.Position[0] += Part0.Direction[0] * Pixel;
                Part0.Position[1] += Part0.Direction[1] * Pixel;
            }

            if (Part0.Type.includes("Radioactive") && !Part0.Type.includes("Light") && Part0.Name !== "NEUT") {
                if (Math.random() < Math.pow(2, -10)) {
                    const Template = ElementsByName.get("NEUT");
                    if (Template) {
                        const NewPart = Object.assign({}, Template);
                        NewPart.Position = [Part0.Position[0], Part0.Position[1]];
                        NewPart.Temperature = Template.Temperature || 22;
                        NewPart.Life = typeof Template.Life === "number" ? Template.Life : parseFloat(Template.Life) || 700;
                        const Angle = Math.random() * Math.PI * 2;
                        NewPart.Direction = [Math.cos(Angle), Math.sin(Angle)];
                        Particles.push(NewPart);
                        Grid.set(CellKey(NewPart.Position[0], NewPart.Position[1], Pixel), NewPart);
                    }
                }
            }

            if (Part0.Life && Part0.Life > 0) Part0.Life -= Simulation.Timescale;
            else if (Part0.Life && Part0.Life < 0) {
                ToRemove.add(Part0);
                Grid.delete(CellKey(Part0.Position[0], Part0.Position[1], Pixel));
            }
        }
        if (ToRemove.size > 0) {
            for (let _ = Particles.length - 1; _ >= 0; _--) if (ToRemove.has(Particles[_])) Particles.splice(_, 1);
        }
    }
};

const Update = () => {
    const CurrentTime = performance.now();
    const ElapsedTime = CurrentTime - LastTime;

    const HoveringParticle = Grid.get(CellKey(Snap(Mouse[0], Simulation.Pixel), Snap(Mouse[1], Simulation.Pixel), Simulation.Pixel));
    document.querySelector(".PartStats").style.opacity = HoveringParticle ? "1" : "0";
    if (Mouse[5] === true) {
        const Properties = ElementsByName.get(Selected);
        if (Properties) {
            const Pixel = Simulation.Pixel;
            const Size = Mouse[4] * Pixel;

            for (let Oy = 0; Oy < Mouse[4]; Oy++) {
                for (let Ox = 0; Ox < Mouse[4]; Ox++) {
                    const Tx = Snap(Mouse[0] - Size, Pixel) + Ox * Pixel;
                    const Ty = Snap(Mouse[1] - Size, Pixel) + Oy * Pixel;
                    if (Grid.has(CellKey(Tx, Ty, Pixel))) continue;
                    const NewParticle = {
                        ...Properties,
                        Position: [Tx, Ty],
                        Temperature: Properties.Temperature || 22
                    };
                    NewParticle.Color = PowderEffect(NewParticle.Color, 16);
                    if (Properties.Type.includes("Light")) {
                        NewParticle.Life = Properties.Life || 1000;
                        const Angle = RandomNumber(0, Math.PI * 2);
                        NewParticle.Direction = [Math.cos(Angle), Math.sin(Angle)];
                    }
                    Particles.push(NewParticle);
                    Grid.set(CellKey(Tx, Ty, Pixel), NewParticle);
                }
            }
        }
    } else if (Mouse[5] === 1) {
        const Size = Mouse[4] * Simulation.Pixel;
        const Dx = Snap(Mouse[0] - Size, Simulation.Pixel);
        const Dy = Snap(Mouse[1] - Size, Simulation.Pixel);
        for (let _ = Particles.length - 1; _ >= 0; _--) {
            if (Particles[_].Position[0] >= Dx && Particles[_].Position[0] <= Dx + Size * 2 &&
                Particles[_].Position[1] >= Dy && Particles[_].Position[1] <= Dy + Size * 2) {
                Grid.delete(CellKey(Particles[_].Position[0], Particles[_].Position[1], Simulation.Pixel));
                Particles.splice(_, 1);
            }
        }
    } else if (HoveringParticle) {
        document.querySelector(".PartStats").innerHTML =
        `<div class="Name">${HoveringParticle.Name}</div>
        <div style="background-color: ${HoveringParticle.Color};" class="Color"></div>
        <div class="Temp">${HoveringParticle.Temperature ? HoveringParticle.Temperature.toFixed(1) : "N/A"}⁰C</div>
        <div style="display: ${HoveringParticle.Life ? "" : "none"}" class="Life">${FormatNumber(Math.floor(HoveringParticle.Life || 0))}</div>`;
    }

    const MousePressure = Pressure.Get(Snap(Mouse[0], Simulation.Pixel), Snap(Mouse[1], Simulation.Pixel));
    document.querySelector(".Pressure").innerHTML = `Pressure: ${FormatNumber(Math.round(MousePressure))} Pa`;

    const Size = Mouse[4] * Simulation.Pixel;
    const Dx = Snap(Mouse[0] - Size, Simulation.Pixel);
    const Dy = Snap(Mouse[1] - Size, Simulation.Pixel);
    document.querySelector(".Drawer").setAttribute("style", `
        left: ${Dx}px;
        top: ${Dy}px;
        width: ${Size}px;
    `);

    if (Mouse[2] !== Mouse[0]) Mouse[2] = Lerp(Mouse[2], Mouse[0], 0.125);
    if (Mouse[3] !== Mouse[1]) Mouse[3] = Lerp(Mouse[3], Mouse[1], 0.125);
    document.querySelector(".Cursor").setAttribute("style", `
        left: ${Mouse[2]}px;
        top: ${Mouse[3]}px;
    `);

    FrameCount++;

    if (ElapsedTime >= UpdateInterval) {
        Framerate = Math.round((FrameCount * 1000) / ElapsedTime);
        FrameCount = 0;
        LastTime = CurrentTime;

        const FramerateDisplay = document.querySelector(".Framerate");
        if (FramerateDisplay) {
            FramerateDisplay.innerHTML =
            `Framerate: ${String(Framerate).padStart(3, "0")}, ${String(Math.floor((Framerate / RefreshRate) * 100)).padStart(3, "0")}%`;
        }
    }

    const Timescale = Simulation.Timescale;
    document.querySelector(".Particles").innerHTML = `Particles: ${FormatNumber(Particles.length)}`;
    document.querySelector(".Timescale").innerHTML = `Timescale: ${Timescale.toFixed(2)}x`;
    const Cr = Timescale < 1 ? 255 : (1 - (Timescale - 1) / 3) * 255;
    const Cg = Timescale < 1 ? (Timescale / 1) * 255 : 255;
    const Cb = Timescale < 1 ? (Timescale / 1) * 255 : 255;
    document.querySelector(".Timescale").setAttribute("style", `
        color: rgb(${Cr}, ${Cg}, ${Cb});
        font-weight: ${Simulation.Timescale == 0 ? "900" : "initial"};
    `);

    Simulate();
    Draw();

    requestAnimationFrame(Update);
};

InitWebGL();
Update();