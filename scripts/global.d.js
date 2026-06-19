const TypeList = document.querySelector(".TypeList");
const Selector = document.querySelector(".Selector");
const Canvas = document.querySelector(".Canvas");
const Gl = Canvas.getContext("webgl2");
Canvas.width = window.innerWidth;
Canvas.height = window.innerHeight;

const Simulation = {
    Timescale: 1,
    Pixel: 8,
    PressureGrid: new Map(),
    ShowPressure: false
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

function DrawRectArray(Gl, Rects) {
    if (Rects.length === 0) return;
    const InstanceData = new Float32Array(Rects.length * 7);
    for (let I = 0; I < Rects.length; I++) {
        const R = Rects[I];
        const Off = I * 7;
        InstanceData[Off] = R.X;
        InstanceData[Off + 1] = R.Y;
        InstanceData[Off + 2] = R.Size;
        InstanceData[Off + 3] = R.R / 255;
        InstanceData[Off + 4] = R.G / 255;
        InstanceData[Off + 5] = R.B / 255;
        InstanceData[Off + 6] = R.A;
    }
    Gl.bindBuffer(Gl.ARRAY_BUFFER, InstanceBuffer);
    Gl.bufferData(Gl.ARRAY_BUFFER, InstanceData, Gl.DYNAMIC_DRAW);
    Gl.drawElementsInstanced(Gl.TRIANGLES, 6, Gl.UNSIGNED_SHORT, 0, Rects.length);
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

    const PressureRects = [];
    if (Simulation.ShowPressure) {
        const PressureCell = Simulation.Pixel * 4;
        Simulation.PressureGrid.forEach((Count, Key) => {
            if (Count <= 0) return;
            const [Gx, Gy] = Key.split(",").map(Number);
            const Alpha = Math.min(1, Count / 16) * 0.35;
            PressureRects.push({
                X: Gx * PressureCell,
                Y: Gy * PressureCell,
                Size: PressureCell,
                R: 0,
                G: 120,
                B: 255,
                A: Alpha
            });
        });
    }

    const GlowRects = [];
    for (const Particle of Particles) {
        const Rings = Math.floor(Math.min(1, Math.abs(Particle.Temperature / Particle.Melt)) * 2);
        const Arr = RgbaToArray(Particle.Color);
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
        }
    }

    const ParticleRects = [];
    for (const Particle of Particles) {
        const Element = Elements.find(E => E.Name == Particle.Name);
        const Arr = RgbaToArray(Particle.Color);
        const TempDiff = Particle.Temperature - (Element ? Element.Temperature : 22) || 22;
        const Value = Math.max(Arr[0] / 4, Arr[0] + TempDiff);
        const Red = Math.min(255, Math.max(0, Value));
        ParticleRects.push({
            X: Particle.Position[0],
            Y: Particle.Position[1],
            Size: Simulation.Pixel,
            R: Red,
            G: Arr[1],
            B: Arr[2],
            A: 1
        });
    }

    DrawRectArray(Gl, PressureRects);
    DrawRectArray(Gl, GlowRects);
    DrawRectArray(Gl, ParticleRects);

    Gl.bindVertexArray(null);
};

const Simulate = () => {
    if (!Simulation.Accumulator) Simulation.Accumulator = 0;
    Simulation.Accumulator += Simulation.Timescale;
    const TotalSteps = Math.floor(Simulation.Accumulator);
    Simulation.Accumulator -= TotalSteps;

    for (let Step = 0; Step < TotalSteps; Step++) {
        const Grid = new Map();
        for (const Part of Particles) Grid.set(`${Part.Position[0]},${Part.Position[1]}`, Part);

        const PressureCell = Simulation.Pixel * 4;
        Simulation.PressureGrid = new Map();
        for (const Part of Particles) {
            if (Part.Type.includes("Solid")) continue;
            const Key = `${Math.floor(Part.Position[0] / PressureCell)},${Math.floor(Part.Position[1] / PressureCell)}`;
            Simulation.PressureGrid.set(Key, (Simulation.PressureGrid.get(Key) || 0) + 1);
        }

        const PressureAt = (Wx, Wy) => Simulation.PressureGrid.get(`${Math.floor(Wx / PressureCell)},${Math.floor(Wy / PressureCell)}`) || 0;
        const PressureDelta = (Wx, Wy, Tx, Ty) => PressureAt(Tx, Ty) - PressureAt(Wx, Wy);

        const UpdatePressure = (OldX, OldY, NewX, NewY) => {
            const OldKey = `${Math.floor(OldX / PressureCell)},${Math.floor(OldY / PressureCell)}`;
            const NewKey = `${Math.floor(NewX / PressureCell)},${Math.floor(NewY / PressureCell)}`;
            if (OldKey === NewKey) return;
            Simulation.PressureGrid.set(OldKey, Math.max(0, (Simulation.PressureGrid.get(OldKey) || 1) - 1));
            Simulation.PressureGrid.set(NewKey, (Simulation.PressureGrid.get(NewKey) || 0) + 1);
        };

        const HasPart = (Px, Py) => Grid.has(`${Px},${Py}`);
        const Move = (Part, Nx, Ny) => {
            UpdatePressure(Part.Position[0], Part.Position[1], Nx, Ny);
            Grid.delete(`${Part.Position[0]},${Part.Position[1]}`);
            Part.Position[0] = Nx;
            Part.Position[1] = Ny;
            Grid.set(`${Nx},${Ny}`, Part);
        };

        const CrumbleActions = [];
        for (const Part of Particles) {
            if (!Part.Type.includes("Solid") || !Part.CrumblePressure) continue;
            const Key = `${Math.floor(Part.Position[0] / PressureCell)},${Math.floor(Part.Position[1] / PressureCell)}`;
            const FluidPressure = Simulation.PressureGrid.get(Key) || 0;
            if (FluidPressure >= Part.CrumblePressure[0]) {
                const BrokenElement = Elements.find(E => E.Name === Part.CrumblePressure[1]);
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
                Grid.delete(`${Action.Old.Position[0]},${Action.Old.Position[1]}`);
                Particles.push(Action.New);
                Grid.set(`${Action.New.Position[0]},${Action.New.Position[1]}`, Action.New);
                const Key = `${Math.floor(Action.New.Position[0] / PressureCell)},${Math.floor(Action.New.Position[1] / PressureCell)}`;
                Simulation.PressureGrid.set(Key, (Simulation.PressureGrid.get(Key) || 0) + 1);
            }
        }

        const ToRemove = new Set();
        for (let Part0 of Particles.slice()) {
            if (ToRemove.has(Part0)) continue;

            if (Part0.Temperature > Part0.Melt) Part0.Type = Part0.Molten;
            if (Part0.Freeze && Part0.Temperature < Part0.Freeze) {
                if (Part0.Cold.startsWith("&")) {
                    const Template = Elements.find(Element => Element.Name === Part0.Cold.split("&")[1]);
                    const SavedPosition = Part0.Position;
                    Object.assign(Part0, Template);
                    Part0.Color = PowderEffect(Part0.Color, 16);
                    Part0.Position = SavedPosition;
                } else Part0.Type = Part0.Cold;
            }

            if (Part0.Temperature > 22) Part0.Temperature -= 0.0625;

            const Pixel = Simulation.Pixel;
            const Px = Part0.Position[0];
            const Py = Part0.Position[1];

            for (const [Ox, Oy] of [[0, Pixel], [0, -Pixel], [Pixel, 0], [-Pixel, 0]]) {
                const Part1 = Grid.get(`${Px + Ox},${Py + Oy}`);
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
                        Grid.delete(`${Doomed.Position[0]},${Doomed.Position[1]}`);
                        if (Doomed === Part0) break;
                        continue;
                    }

                    const Products = Part0.Reactive[2];
                    if (Products && Products.length > 0) {
                        const ProductRoll = Math.floor(Math.random() * 100);
                        if (ProductRoll >= Threshold) {
                            const Chosen = Products[Math.floor(Math.random() * Products.length)];
                            const Template = Elements.find(E => E.Name === Chosen);
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
                                Grid.set(`${Spawn.Position[0]},${Spawn.Position[1]}`, Spawn);
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
                Grid.delete(`${Cx},${Cy}`);
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
            } else if (Part0.Type.includes("Liquid")) {
                const DownOpen      = Cy < Wh - Pixel && !HasPart(Cx, Cy + Pixel);
                const LeftDownOpen  = Cy < Wh - Pixel && Cx > 0 && !HasPart(Cx - Pixel, Cy + Pixel);
                const RightDownOpen = Cy < Wh - Pixel && Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy + Pixel);
                const LeftOpen      = Cx > 0 && !HasPart(Cx - Pixel, Cy);
                const RightOpen     = Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy);
                        
                if (DownOpen) Move(Part0, Cx, Cy + Pixel);
                else if (LeftDownOpen && RightDownOpen) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy + Pixel);
                else if (LeftDownOpen) Move(Part0, Cx - Pixel, Cy + Pixel);
                else if (RightDownOpen) Move(Part0, Cx + Pixel, Cy + Pixel);
                else if (LeftOpen && RightOpen) {
                    const LeftPressure  = PressureDelta(Cx, Cy, Cx - Pixel, Cy);
                    const RightPressure = PressureDelta(Cx, Cy, Cx + Pixel, Cy);
                    if (Math.abs(LeftPressure - RightPressure) < 2) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy);
                    else if (LeftPressure < RightPressure) Move(Part0, Cx - Pixel, Cy);
                    else Move(Part0, Cx + Pixel, Cy);
                } else if (LeftOpen) Move(Part0, Cx - Pixel, Cy);
                else if (RightOpen) Move(Part0, Cx + Pixel, Cy);
            } else if (Part0.Type.includes("Gas")) {
                const UpOpen      = !HasPart(Cx, Cy - Pixel);
                const LeftUpOpen  = Cy > 0 && Cx > 0 && !HasPart(Cx - Pixel, Cy - Pixel);
                const RightUpOpen = Cy > 0 && Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy - Pixel);
                const LeftOpen    = Cx > 0 && !HasPart(Cx - Pixel, Cy);
                const RightOpen   = Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy);

                if (UpOpen) Move(Part0, Cx, Cy - Pixel);
                else if (LeftUpOpen && RightUpOpen) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy - Pixel);
                else if (LeftUpOpen) Move(Part0, Cx - Pixel, Cy - Pixel);
                else if (RightUpOpen) Move(Part0, Cx + Pixel, Cy - Pixel); 
                else if (LeftOpen && RightOpen) {
                    const LeftPressure  = PressureDelta(Cx, Cy, Cx - Pixel, Cy);
                    const RightPressure = PressureDelta(Cx, Cy, Cx + Pixel, Cy);
                    if (Math.abs(LeftPressure - RightPressure) < 2) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy);
                    else if (LeftPressure < RightPressure) Move(Part0, Cx - Pixel, Cy);
                    else Move(Part0, Cx + Pixel, Cy);
                } else if (LeftOpen) Move(Part0, Cx - Pixel, Cy);
                else if (RightOpen) Move(Part0, Cx + Pixel, Cy);
            } else if (Part0.Type.includes("Light")) {
                Part0.Position[0] += Part0.Direction[0] * Pixel;
                Part0.Position[1] += Part0.Direction[1] * Pixel;
            }

            if (Part0.Type.includes("Radioactive") && !Part0.Type.includes("Light") && Part0.Name !== "NEUT") {
                if (Math.random() < Math.pow(2, -10)) {
                    const Template = Elements.find(E => E.Name === "NEUT");
                    if (Template) {
                        const NewPart = Object.assign({}, Template);
                        NewPart.Position = [Part0.Position[0], Part0.Position[1]];
                        NewPart.Temperature = Template.Temperature || 22;
                        NewPart.Life = typeof Template.Life === "number" ? Template.Life : parseFloat(Template.Life) || 700;
                        const Angle = Math.random() * Math.PI * 2;
                        NewPart.Direction = [Math.cos(Angle), Math.sin(Angle)];
                        Particles.push(NewPart);
                        Grid.set(`${NewPart.Position[0]},${NewPart.Position[1]}`, NewPart);
                    }
                }
            }

            if (Part0.Life && Part0.Life > 0) Part0.Life -= Simulation.Timescale;
            else if (Part0.Life && Part0.Life < 0) {
                ToRemove.add(Part0);
                Grid.delete(`${Part0.Position[0]},${Part0.Position[1]}`);
            }
        }
        for (let _ = Particles.length - 1; _ >= 0; _--) if (ToRemove.has(Particles[_])) Particles.splice(_, 1);
    }
};

const Update = () => {
    const CurrentTime = performance.now();
    const ElapsedTime = CurrentTime - LastTime;

    const HoveringParticle = Particles.find(
        Particle => Particle.Position[0] === Snap(Mouse[0], Simulation.Pixel) && Particle.Position[1] === Snap(Mouse[1], Simulation.Pixel)
    );
    document.querySelector(".PartStats").style.opacity = HoveringParticle ? "1" : "0";
    if (Mouse[5] === true) {
        const Properties = Elements.find(Element => Element.Name === Selected);
        if (Properties) {
            const Pixel = Simulation.Pixel;
            const Size = Mouse[4] * Pixel;

            for (let Oy = 0; Oy < Mouse[4]; Oy++) {
                for (let Ox = 0; Ox < Mouse[4]; Ox++) {
                    const Tx = Snap(Mouse[0] - Size, Pixel) + Ox * Pixel;
                    const Ty = Snap(Mouse[1] - Size, Pixel) + Oy * Pixel;
                    const AlreadyExists = Particles.find(P => P.Position[0] === Tx && P.Position[1] === Ty);
                    if (AlreadyExists) continue;
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
                }
            }
        }
    } else if (Mouse[5] === 1) {
        const Size = Mouse[4] * Simulation.Pixel;
        const Dx = Snap(Mouse[0] - Size, Simulation.Pixel);
        const Dy = Snap(Mouse[1] - Size, Simulation.Pixel);
        for (let _ = Particles.length - 1; _ >= 0; _--) {
            if (Particles[_].Position[0] >= Dx && Particles[_].Position[0] <= Dx + Size * 2 &&
                Particles[_].Position[1] >= Dy && Particles[_].Position[1] <= Dy + Size * 2)
                Particles.splice(_, 1);
        }
    } else if (HoveringParticle) {
        document.querySelector(".PartStats").innerHTML =
        `<div class="Name">${HoveringParticle.Name}</div>
        <div style="background-color: ${HoveringParticle.Color};" class="Color"></div>
        <div class="Temp">${HoveringParticle.Temperature ? HoveringParticle.Temperature.toFixed(1) : "N/A"}⁰C</div>
        <div style="display: ${HoveringParticle.Life ? "" : "none"}" class="Life">${FormatNumber(Math.floor(HoveringParticle.Life || 0))}</div>`;
    }

    const PressureCell = Simulation.Pixel * 4;
    const MousePressureKey = `${Math.floor(Snap(Mouse[0], Simulation.Pixel) / PressureCell)},${Math.floor(Snap(Mouse[1], Simulation.Pixel) / PressureCell)}`;
    const MousePressure = Simulation.PressureGrid.get(MousePressureKey) || 0;
    document.querySelector(".Pressure").innerHTML = `Pressure: ${FormatNumber(MousePressure)} Pa`;

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