const TypeList = document.querySelector(".TypeList");
const Selector = document.querySelector(".Selector");
const Canvas = document.querySelector(".Canvas");
const Gl = Canvas.getContext("webgl2", {
    Antialias: true,
    Alpha: false,
    Desynchronized: true,
    PowerPreference: "high-performance"
});
const Dpr = Math.min(window.devicePixelRatio || 1, 2);
Canvas.width = window.innerWidth * Dpr;
Canvas.height = window.innerHeight * Dpr;
Canvas.style.width = window.innerWidth + "px";
Canvas.style.height = window.innerHeight + "px";

const ElementsByName = new Map();
for (const Name in Elements) ElementsByName.set(Name, Elements[Name]);

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
    Pixel: 4,
    ShowPressure: false,
    AirDensity: 0.95,
    AirViscosity: 0.15,
    AirUpdate: 0.85,
    VelocityCap: 16,
    PressureCap: 256,
    FlowBias: 0.2,
    ExplosionScale: 3.0,
    AmbientTemp: 22
};

const Particles = [];
const Mouse = [0, 0, 0, 0, 1, false];

let Selected = "Dust";

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

    const QuadVertices = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
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

let InstanceScratch = new Float32Array(0);
function EnsureScratch(Count) {
    const Needed = Count * 7;
    if (InstanceScratch.length < Needed) InstanceScratch = new Float32Array(Needed);
    return InstanceScratch;
}

function DrawRectArray(Gl, Rects, Count) {
    if (Count === 0) return;
    const InstanceData = EnsureScratch(Count);
    for (let I = 0; I < Count; I++) {
        const Off = I * 7;
        const R = Rects[I];
        InstanceData[Off] = R.X;
        InstanceData[Off + 1] = R.Y;
        InstanceData[Off + 2] = R.Size;
        InstanceData[Off + 3] = R.R / 255;
        InstanceData[Off + 4] = R.G / 255;
        InstanceData[Off + 5] = R.B / 255;
        InstanceData[Off + 6] = R.A;
    }
    Gl.bindBuffer(Gl.ARRAY_BUFFER, InstanceBuffer);
    Gl.bufferData(Gl.ARRAY_BUFFER, InstanceData.subarray(0, Count * 7), Gl.DYNAMIC_DRAW);
    Gl.drawElementsInstanced(Gl.TRIANGLES, 6, Gl.UNSIGNED_SHORT, 0, Count);
}

function EnsureRectPool(Pool, Count) {
    while (Pool.length < Count) Pool.push({ X: 0, Y: 0, Size: 0, R: 0, G: 0, B: 0, A: 0 });
    return Pool;
}

let GlowRectPool = [];
let ParticleRectPool = [];
let PressureRectPool = [];

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

Object.values(Elements).forEach(Element => {
    const ElementDiv = document.createElement("div");
    ElementDiv.innerHTML = Element.Icon ? `<img src="${Element.Icon}">` : String(Element.Name).toUpperCase();
    ElementDiv.style.backgroundColor = Element.Color;
    const [Cr, Cg, Cb] = Element.Color.match(/\d+/g).map(Number);
    (0.299 * Cr + 0.587 * Cg + 0.114 * Cb) / 255 < 0.25 ? ElementDiv.style.color = "rgb(255, 255, 255)" : ElementDiv.style.color = "rgb(0, 0, 0)";
    const TypeKey = String(Element.Type.includes(",") && Element.Type.includes("Gas") ? Element.Type.split(",")[1] : Element.Type).trim();
    if (Selector.querySelector(`.${TypeKey}`)) {
        Selector.querySelector(`.${TypeKey}`).appendChild(ElementDiv);
        ElementDiv.addEventListener("click", () => Selected = Element.Name);
    }
});

document.addEventListener("contextmenu", Event => Event.preventDefault(), { Passive: false });
document.addEventListener("mousemove", Event => {
    Mouse[0] = Event.clientX;
    Mouse[1] = Event.clientY;
});
document.addEventListener("mousedown", Event => {
    Mouse[5] = Event.button === 2 ? 1 : true;
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
}, { Passive: false });
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
(async () => { RefreshRate = await GetRefreshRate(); })();

const GridStride = 8192;
let InvPixel = 1 / Simulation.Pixel;
function SetPixelSize(NewPixel) {
    Simulation.Pixel = NewPixel;
    InvPixel = 1 / NewPixel;
}

function CellKey(Px, Py, InvP) {
    return (((Py * InvP) | 0) + 4096) * GridStride + (((Px * InvP) | 0) + 4096);
}

let Grid = new Map();
function RebuildGrid() {
    Grid.clear();
    for (let I = 0; I < Particles.length; I++) {
        const P = Particles[I];
        Grid.set(CellKey(P.Position[0], P.Position[1], InvPixel), P);
    }
}
RebuildGrid();

function ComputeFlags(Part) {
    const T = Part.Type;
    Part.IsSolid = T.includes("Solid");
    Part.IsPowder = T.includes("Powder");
    Part.IsLiquid = T.includes("Liquid");
    Part.IsGas = T.includes("Gas");
    Part.IsLight = T.includes("Light");
    Part.IsRadioactive = T.includes("Radioactive");
}

const ZeroVel = [0, 0];
const GradOut = [0, 0];

class AirSim {
    constructor(CellSize) {
        this.CellSize = CellSize;
        this.W = 0;
        this.H = 0;
        this.Pv = null;
        this.Vx = null;
        this.Vy = null;
        this.PvT = null;
        this.VxT = null;
        this.VyT = null;
        this.Block = null;
        this.Resize();
    }

    Resize() {
        const NewW = Math.ceil(window.innerWidth / this.CellSize) + 4;
        const NewH = Math.ceil(window.innerHeight / this.CellSize) + 4;
        if (NewW === this.W && NewH === this.H) return;
        this.W = NewW;
        this.H = NewH;
        const Size = this.W * this.H;
        this.Pv = new Float32Array(Size);
        this.Vx = new Float32Array(Size);
        this.Vy = new Float32Array(Size);
        this.PvT = new Float32Array(Size);
        this.VxT = new Float32Array(Size);
        this.VyT = new Float32Array(Size);
        this.Block = new Uint8Array(Size);
    }

    Idx(X, Y) {
        return Y * this.W + X;
    }

    CellX(Wx) {
        return (Wx / this.CellSize) | 0;
    }

    CellY(Wy) {
        return (Wy / this.CellSize) | 0;
    }

    ClearBlocks() {
        this.Block.fill(0);
    }

    SetBlock(Wx, Wy) {
        const Cx = this.CellX(Wx);
        const Cy = this.CellY(Wy);
        if (Cx >= 0 && Cy >= 0 && Cx < this.W && Cy < this.H) this.Block[this.Idx(Cx, Cy)] = 1;
    }

    AddPressure(Wx, Wy, Amount) {
        const Cx = this.CellX(Wx);
        const Cy = this.CellY(Wy);
        if (Cx <= 0 || Cy <= 0 || Cx >= this.W - 1 || Cy >= this.H - 1) return;
        const I = this.Idx(Cx, Cy);
        this.Pv[I] = Math.max(-Simulation.PressureCap, Math.min(Simulation.PressureCap, this.Pv[I] + Amount));
    }

    AddVelocity(Wx, Wy, Fx, Fy) {
        const Cx = this.CellX(Wx);
        const Cy = this.CellY(Wy);
        if (Cx <= 0 || Cy <= 0 || Cx >= this.W - 1 || Cy >= this.H - 1) return;
        const I = this.Idx(Cx, Cy);
        const Cap = Simulation.VelocityCap;
        this.Vx[I] = Math.max(-Cap, Math.min(Cap, this.Vx[I] + Fx));
        this.Vy[I] = Math.max(-Cap, Math.min(Cap, this.Vy[I] + Fy));
    }

    Get(Wx, Wy) {
        const Cx = this.CellX(Wx);
        const Cy = this.CellY(Wy);
        if (Cx < 0 || Cy < 0 || Cx >= this.W || Cy >= this.H) return 0;
        return this.Pv[this.Idx(Cx, Cy)];
    }

    GetVelocity(Wx, Wy) {
        const Cx = this.CellX(Wx);
        const Cy = this.CellY(Wy);
        if (Cx < 0 || Cy < 0 || Cx >= this.W || Cy >= this.H) {
            ZeroVel[0] = 0;
            ZeroVel[1] = 0;
            return ZeroVel;
        }
        const I = this.Idx(Cx, Cy);
        ZeroVel[0] = this.Vx[I];
        ZeroVel[1] = this.Vy[I];
        return ZeroVel;
    }

    Gradient(Wx, Wy) {
        const Cell = this.CellSize;
        GradOut[0] = (this.Get(Wx - Cell, Wy) - this.Get(Wx + Cell, Wy)) * 0.5;
        GradOut[1] = (this.Get(Wx, Wy - Cell) - this.Get(Wx, Wy + Cell)) * 0.5;
        return GradOut;
    }

    Step() {
        this.Resize();
        const W = this.W;
        const H = this.H;
        const Pv = this.Pv;
        const Vx = this.Vx;
        const Vy = this.Vy;
        const PvT = this.PvT;
        const VxT = this.VxT;
        const VyT = this.VyT;
        const Block = this.Block;
        const Density = Simulation.AirDensity;
        const Visc = Simulation.AirViscosity;
        const Update = Simulation.AirUpdate;
        const Cap = Simulation.VelocityCap;
        const PCap = Simulation.PressureCap;

        for (let Y = 1; Y < H - 1; Y++) {
            const Row = Y * W;
            for (let X = 1; X < W - 1; X++) {
                const I = Row + X;
                if (Block[I]) {
                    Vx[I] = 0;
                    Vy[I] = 0;
                    Pv[I] *= 0.5;
                    continue;
                }
                const Dx = Vx[I - 1] - Vx[I + 1];
                const Dy = Vy[I - W] - Vy[I + W];
                PvT[I] = Pv[I] * Density + (Dx + Dy) * 0.5;
                if (PvT[I] > PCap) PvT[I] = PCap;
                else if (PvT[I] < -PCap) PvT[I] = -PCap;
            }
        }

        for (let Y = 1; Y < H - 1; Y++) {
            const Row = Y * W;
            for (let X = 1; X < W - 1; X++) {
                const I = Row + X;
                if (Block[I]) continue;
                const Av = (
                    PvT[I - 1] + PvT[I + 1] +
                    PvT[I - W] + PvT[I + W]
                ) * 0.25;
                Pv[I] = Pv[I] * (1 - Update) + Av * Update;
            }
        }

        for (let Y = 1; Y < H - 1; Y++) {
            const Row = Y * W;
            for (let X = 1; X < W - 1; X++) {
                const I = Row + X;
                if (Block[I]) {
                    VxT[I] = 0;
                    VyT[I] = 0;
                    continue;
                }
                const Gx = (Pv[I - 1] - Pv[I + 1]) * 0.5;
                const Gy = (Pv[I - W] - Pv[I + W]) * 0.5;
                let Nvx = Vx[I] * (1 - Visc) + Gx * Visc;
                let Nvy = Vy[I] * (1 - Visc) + Gy * Visc;
                if (Nvx > Cap) Nvx = Cap;
                else if (Nvx < -Cap) Nvx = -Cap;
                if (Nvy > Cap) Nvy = Cap;
                else if (Nvy < -Cap) Nvy = -Cap;
                VxT[I] = Nvx;
                VyT[I] = Nvy;
            }
        }

        for (let Y = 1; Y < H - 1; Y++) {
            const Row = Y * W;
            for (let X = 1; X < W - 1; X++) {
                const I = Row + X;
                if (Block[I]) continue;
                const Avx = (
                    VxT[I - 1] + VxT[I + 1] +
                    VxT[I - W] + VxT[I + W]
                ) * 0.25;
                const Avy = (
                    VyT[I - 1] + VyT[I + 1] +
                    VyT[I - W] + VyT[I + W]
                ) * 0.25;
                Vx[I] = Vx[I] * (1 - Update) + Avx * Update;
                Vy[I] = Vy[I] * (1 - Update) + Avy * Update;
            }
        }

        for (let X = 0; X < W; X++) {
            Pv[X] = 0;
            Pv[(H - 1) * W + X] = 0;
            Vx[X] = 0;
            Vx[(H - 1) * W + X] = 0;
            Vy[X] = 0;
            Vy[(H - 1) * W + X] = 0;
        }
        for (let Y = 0; Y < H; Y++) {
            const L = Y * W;
            const R = L + W - 1;
            Pv[L] = 0;
            Pv[R] = 0;
            Vx[L] = 0;
            Vx[R] = 0;
            Vy[L] = 0;
            Vy[R] = 0;
        }
    }
}

const AirCellSize = Simulation.Pixel * 2;
const Air = new AirSim(AirCellSize);

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

    let PressureCount = 0;
    if (Simulation.ShowPressure) {
        const Cell = Air.CellSize;
        EnsureRectPool(PressureRectPool, Air.W * Air.H);
        for (let Y = 0; Y < Air.H; Y++) {
            for (let X = 0; X < Air.W; X++) {
                const Value = Air.Pv[Y * Air.W + X];
                if (Math.abs(Value) <= 0.08) continue;
                const Positive = Value >= 0;
                const Alpha = Math.min(1, Math.abs(Value) / 24) * 0.4;
                const Rect = PressureRectPool[PressureCount++];
                Rect.X = X * Cell;
                Rect.Y = Y * Cell;
                Rect.Size = Cell;
                Rect.R = Positive ? 40 : 255;
                Rect.G = Positive ? 140 : 40;
                Rect.B = Positive ? 255 : 40;
                Rect.A = Alpha;
            }
        }
    }

    EnsureRectPool(GlowRectPool, Particles.length * 2);
    let GlowCount = 0;
    for (let I = 0; I < Particles.length; I++) {
        const Particle = Particles[I];
        const Rings = Math.floor(Math.min(1, Math.abs(Particle.Temperature / (Particle.Melt || 1))) * 2);
        if (Rings <= 0) continue;
        const Arr = GetRgba(Particle.Color);
        for (let R = 1; R <= Rings; R++) {
            const Size = Simulation.Pixel + R * Simulation.Pixel * 2;
            const Offset = (Size - Simulation.Pixel) * 0.5;
            const Rect = GlowRectPool[GlowCount++];
            Rect.X = Particle.Position[0] - Offset;
            Rect.Y = Particle.Position[1] - Offset;
            Rect.Size = Size;
            Rect.R = Arr[0];
            Rect.G = Arr[1];
            Rect.B = Arr[2];
            Rect.A = 0.0125;
        }
    }

    EnsureRectPool(ParticleRectPool, Particles.length);
    const ParticleCount = Particles.length;
    for (let I = 0; I < ParticleCount; I++) {
        const Particle = Particles[I];
        const Element = ElementsByName.get(Particle.Name);
        const Arr = GetRgba(Particle.Color);
        const BaseTemp = Element ? Element.Temperature : Simulation.AmbientTemp;
        const TempDiff = Particle.Temperature - BaseTemp;
        const Value = Math.max(Arr[0] * 0.25, Arr[0] + TempDiff);
        const Rect = ParticleRectPool[I];
        Rect.X = Particle.Position[0];
        Rect.Y = Particle.Position[1];
        Rect.Size = Simulation.Pixel;
        Rect.R = Math.min(255, Math.max(0, Value));
        Rect.G = Arr[1];
        Rect.B = Arr[2];
        Rect.A = 1;
    }

    if (Simulation.ShowPressure) DrawRectArray(Gl, PressureRectPool, PressureCount);
    DrawRectArray(Gl, GlowRectPool, GlowCount);
    DrawRectArray(Gl, ParticleRectPool, ParticleCount);
    Gl.bindVertexArray(null);
};

const Simulate = () => {
    if (!Simulation.Accumulator) Simulation.Accumulator = 0;
    Simulation.Accumulator += Simulation.Timescale;
    const TotalSteps = Math.min(8, Math.floor(Simulation.Accumulator));
    Simulation.Accumulator -= TotalSteps;
    if (TotalSteps <= 0) return;

    const Pixel = Simulation.Pixel;
    const InvP = InvPixel;
    const Ww = window.innerWidth;
    const Wh = window.innerHeight;

    for (let Step = 0; Step < TotalSteps; Step++) {
        Air.ClearBlocks();
        for (let I = 0; I < Particles.length; I++) {
            const P = Particles[I];
            if (P.IsSolid || (P.IsPowder && !P.IsGas)) {
                Air.SetBlock(P.Position[0], P.Position[1]);
            }
        }

        for (let I = 0; I < Particles.length; I++) {
            const P = Particles[I];
            if (!P.IsGas) continue;
            const Pmd = typeof P.Pmd === "number" ? P.Pmd : 1;
            Air.AddPressure(P.Position[0], P.Position[1], 0.8 * Pmd);
        }

        Air.Step();

        const HasPart = (Px, Py) => Grid.has(CellKey(Px, Py, InvP));
        const Move = (Part, Nx, Ny) => {
            Grid.delete(CellKey(Part.Position[0], Part.Position[1], InvP));
            Part.Position[0] = Nx;
            Part.Position[1] = Ny;
            Grid.set(CellKey(Nx, Ny, InvP), Part);
        };

        const ToRemove = new Set();
        const Neighbors = [[0, Pixel], [0, -Pixel], [Pixel, 0], [-Pixel, 0]];

        for (let Index0 = 0; Index0 < Particles.length; Index0++) {
            const Part0 = Particles[Index0];
            if (ToRemove.has(Part0)) continue;

            if (Part0.Temperature > Part0.Melt) {
                Part0.Type = Part0.Molten;
                ComputeFlags(Part0);
            }
            if (Part0.Freeze && Part0.Temperature < Part0.Freeze) {
                if (typeof Part0.Cold === "string" && Part0.Cold.startsWith("&")) {
                    const Template = ElementsByName.get(Part0.Cold.split("&")[1]);
                    if (Template) {
                        const SavedPosition = Part0.Position;
                        const SavedVelocity = Part0.Velocity;
                        Object.assign(Part0, Template);
                        Part0.Color = PowderEffect(Part0.Color, 16);
                        Part0.Position = SavedPosition;
                        Part0.Velocity = SavedVelocity || [0, 0];
                        ComputeFlags(Part0);
                    }
                } else {
                    Part0.Type = Part0.Cold;
                    ComputeFlags(Part0);
                }
            }

            if (Part0.Temperature > Simulation.AmbientTemp) Part0.Temperature -= 0.05;
            else if (Part0.Temperature < Simulation.AmbientTemp) Part0.Temperature += 0.02;

            const Px = Part0.Position[0];
            const Py = Part0.Position[1];

            for (let N = 0; N < 4; N++) {
                const Ox = Neighbors[N][0];
                const Oy = Neighbors[N][1];
                const Part1 = Grid.get(CellKey(Px + Ox, Py + Oy, InvP));
                if (!Part1 || ToRemove.has(Part1)) continue;

                if (Math.abs(Part0.Temperature - Part1.Temperature) >= 0.2) {
                    const Average = (Part0.Temperature + Part1.Temperature) * 0.5;
                    Part0.Temperature = Average;
                    Part1.Temperature = Average;
                }

                if (Part0.Reactive && Part0.Reactive.With && Part0.Reactive.With.includes(Part1.Name)) {
                    const Energy = Part0.Reactive.Chance;
                    Part0.Temperature += Energy;
                    Part1.Temperature += Energy;
                    const Threshold = Math.max(0, 120 - Energy);
                    const VaporizeRoll = (Math.random() * 100) | 0;
                    if (VaporizeRoll >= Threshold) {
                        const Doomed = ((Math.random() * 100) | 0) >= 50 ? Part0 : Part1;
                        ToRemove.add(Doomed);
                        Grid.delete(CellKey(Doomed.Position[0], Doomed.Position[1], InvP));
                        const DoomedPmd = typeof Doomed.Pmd === "number" ? Doomed.Pmd : 1;
                        Air.AddPressure(Doomed.Position[0], Doomed.Position[1], 12 * DoomedPmd);
                        for (let E = 0; E < 8; E++) {
                            const Ex = Neighbors[E % 4][0] + (E > 3 ? Neighbors[(E + 1) % 4][0] : 0);
                            const Ey = Neighbors[E % 4][1] + (E > 3 ? Neighbors[(E + 1) % 4][1] : 0);
                            const Len = Math.hypot(Ex, Ey) || 1;
                            Air.AddVelocity(
                                Doomed.Position[0] + Ex,
                                Doomed.Position[1] + Ey,
                                (Ex / Len) * Simulation.ExplosionScale,
                                (Ey / Len) * Simulation.ExplosionScale
                            );
                        }
                        if (Doomed === Part0) break;
                        continue;
                    }

                    const Products = Part0.Reactive.Products;
                    if (Products && Products.length > 0) {
                        if (((Math.random() * 100) | 0) >= Threshold) {
                            const Chosen = Products[(Math.random() * Products.length) | 0];
                            const Template = ElementsByName.get(Chosen);
                            if (Template) {
                                const Spawn = Object.assign({}, Template);
                                Spawn.Position = [Part0.Position[0], Part0.Position[1]];
                                Spawn.Temperature = Template.Temperature || Simulation.AmbientTemp;
                                Spawn.Velocity = [0, 0];
                                Spawn.Drift = [0, 0];
                                ComputeFlags(Spawn);
                                if (Spawn.IsLight) {
                                    Spawn.Life = typeof Template.Life === "number" ? Template.Life : parseFloat(Template.Life) || 700;
                                    const Angle = Math.random() * Math.PI * 2;
                                    Spawn.Direction = [Math.cos(Angle), Math.sin(Angle)];
                                }
                                Particles.push(Spawn);
                                Grid.set(CellKey(Spawn.Position[0], Spawn.Position[1], InvP), Spawn);
                            }
                        }
                    }

                    if (Part0.Reactive.Extra) {
                        Part1.Color = PowderEffect(Part1.Color, 16);
                        Part1.Name = `A${Part1.Name}`;
                        if (!Part1.IsLiquid && !Part1.IsGas) {
                            Part1.Type = Part1.Type.replace("Solid", "Powder");
                            ComputeFlags(Part1);
                        }
                    }
                }
            }

            if (ToRemove.has(Part0)) continue;

            if (!Part0.Velocity) Part0.Velocity = [0, 0];
            if (!Part0.Drift) Part0.Drift = [0, 0];

            const ElementDef = ElementsByName.get(Part0.Name);
            const Loss = ElementDef && typeof ElementDef.Loss === "number" ? ElementDef.Loss : 0.92;
            const Adv = ElementDef && typeof ElementDef.Advection === "number" ? ElementDef.Advection : 0.65;

            const FieldVel = Air.GetVelocity(Px, Py);
            const FieldVx = FieldVel[0];
            const FieldVy = FieldVel[1];
            Part0.Velocity[0] = Part0.Velocity[0] * Loss + FieldVx * Adv;
            Part0.Velocity[1] = Part0.Velocity[1] * Loss + FieldVy * Adv;

            let Flung = false;
            if (!Part0.IsSolid) {
                Part0.Drift[0] += Part0.Velocity[0];
                Part0.Drift[1] += Part0.Velocity[1];

                while (Math.abs(Part0.Drift[0]) >= Pixel || Math.abs(Part0.Drift[1]) >= Pixel) {
                    const StepX = Part0.Drift[0] >= Pixel ? Pixel : (Part0.Drift[0] <= -Pixel ? -Pixel : 0);
                    const StepY = Part0.Drift[1] >= Pixel ? Pixel : (Part0.Drift[1] <= -Pixel ? -Pixel : 0);
                    if (StepX === 0 && StepY === 0) break;
                    const Tx = Part0.Position[0] + StepX;
                    const Ty = Part0.Position[1] + StepY;
                    if (!Grid.has(CellKey(Tx, Ty, InvP))) {
                        Move(Part0, Tx, Ty);
                        Flung = true;
                    } else {
                        Part0.Velocity[0] *= 0.4;
                        Part0.Velocity[1] *= 0.4;
                        Part0.Drift[0] = 0;
                        Part0.Drift[1] = 0;
                        break;
                    }
                    if (StepX !== 0) Part0.Drift[0] -= StepX;
                    if (StepY !== 0) Part0.Drift[1] -= StepY;
                }
            }

            if (Part0.IsSolid) continue;

            const Cx = Part0.Position[0];
            const Cy = Part0.Position[1];

            if (Cx < 0 || Cx >= Ww || Cy < 0 || Cy >= Wh) {
                ToRemove.add(Part0);
                Grid.delete(CellKey(Cx, Cy, InvP));
                continue;
            }

            if (!Flung) {
                if (Part0.IsPowder) {
                    if (Cy < Wh - Pixel) {
                        if (!HasPart(Cx, Cy + Pixel)) Move(Part0, Cx, Cy + Pixel);
                        else {
                            const LeftOpen = Cx > 0 && !HasPart(Cx - Pixel, Cy + Pixel);
                            const RightOpen = Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy + Pixel);
                            if (LeftOpen && RightOpen) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy + Pixel);
                            else if (LeftOpen) Move(Part0, Cx - Pixel, Cy + Pixel);
                            else if (RightOpen) Move(Part0, Cx + Pixel, Cy + Pixel);
                        }
                    }
                } else if (Part0.IsLiquid || Part0.IsGas) {
                    const IsGas = Part0.IsGas;
                    const VertDir = IsGas ? -Pixel : Pixel;
                    const VertOpen = IsGas ? !HasPart(Cx, Cy - Pixel) : (Cy < Wh - Pixel && !HasPart(Cx, Cy + Pixel));
                    const DiagLeftOpen = IsGas
                        ? (Cx > 0 && !HasPart(Cx - Pixel, Cy - Pixel))
                        : (Cy < Wh - Pixel && Cx > 0 && !HasPart(Cx - Pixel, Cy + Pixel));
                    const DiagRightOpen = IsGas
                        ? (Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy - Pixel))
                        : (Cy < Wh - Pixel && Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy + Pixel));
                    const LeftOpen = Cx > 0 && !HasPart(Cx - Pixel, Cy);
                    const RightOpen = Cx < Ww - Pixel && !HasPart(Cx + Pixel, Cy);

                    if (VertOpen) Move(Part0, Cx, Cy + VertDir);
                    else if (DiagLeftOpen && DiagRightOpen) Move(Part0, Cx + (Math.random() > 0.5 ? Pixel : -Pixel), Cy + VertDir);
                    else if (DiagLeftOpen) Move(Part0, Cx - Pixel, Cy + VertDir);
                    else if (DiagRightOpen) Move(Part0, Cx + Pixel, Cy + VertDir);
                    else if (LeftOpen || RightOpen) {
                        const Grad = Air.Gradient(Cx, Cy);
                        const Gx = Grad[0];
                        let Score = Gx * Simulation.FlowBias + (Math.random() - 0.5) * 0.4;
                        if (!LeftOpen) Score = 1;
                        else if (!RightOpen) Score = -1;
                        if (Score > 0 && RightOpen) Move(Part0, Cx + Pixel, Cy);
                        else if (Score <= 0 && LeftOpen) Move(Part0, Cx - Pixel, Cy);
                        else if (RightOpen) Move(Part0, Cx + Pixel, Cy);
                        else if (LeftOpen) Move(Part0, Cx - Pixel, Cy);
                    }
                } else if (Part0.IsLight && Part0.Direction) {
                    Part0.Position[0] += Part0.Direction[0] * Pixel;
                    Part0.Position[1] += Part0.Direction[1] * Pixel;
                }
            }

            if (Part0.IsRadioactive && !Part0.IsLight && Part0.Name !== "Neut") {
                if (Math.random() < 0.0009765625) {
                    const Template = ElementsByName.get("Neut");
                    if (Template) {
                        const NewPart = Object.assign({}, Template);
                        NewPart.Position = [Part0.Position[0], Part0.Position[1]];
                        NewPart.Temperature = Template.Temperature || Simulation.AmbientTemp;
                        NewPart.Life = typeof Template.Life === "number" ? Template.Life : parseFloat(Template.Life) || 700;
                        NewPart.Velocity = [0, 0];
                        NewPart.Drift = [0, 0];
                        const Angle = Math.random() * Math.PI * 2;
                        NewPart.Direction = [Math.cos(Angle), Math.sin(Angle)];
                        ComputeFlags(NewPart);
                        Particles.push(NewPart);
                        Grid.set(CellKey(NewPart.Position[0], NewPart.Position[1], InvP), NewPart);
                    }
                }
            }

            if (Part0.Life !== null && Part0.Life !== undefined) {
                if (Part0.Life > 0) Part0.Life -= Simulation.Timescale;
                else {
                    ToRemove.add(Part0);
                    Grid.delete(CellKey(Part0.Position[0], Part0.Position[1], InvP));
                }
            }
        }

        if (ToRemove.size > 0) {
            let Write = 0;
            for (let Read = 0; Read < Particles.length; Read++) {
                if (!ToRemove.has(Particles[Read])) {
                    Particles[Write++] = Particles[Read];
                }
            }
            Particles.length = Write;
        }
    }
};

const Update = () => {
    const CurrentTime = performance.now();
    const ElapsedTime = CurrentTime - LastTime;

    const HoveringParticle = Grid.get(CellKey(Snap(Mouse[0], Simulation.Pixel), Snap(Mouse[1], Simulation.Pixel), InvPixel));
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
                    if (Grid.has(CellKey(Tx, Ty, InvPixel))) continue;
                    const NewParticle = {
                        ...Properties,
                        Position: [Tx, Ty],
                        Temperature: Properties.Temperature || Simulation.AmbientTemp,
                        Velocity: [0, 0],
                        Drift: [0, 0]
                    };
                    NewParticle.Color = PowderEffect(NewParticle.Color, 16);
                    ComputeFlags(NewParticle);
                    if (NewParticle.IsLight) {
                        NewParticle.Life = Properties.Life || 1000;
                        const Angle = RandomNumber(0, Math.PI * 2);
                        NewParticle.Direction = [Math.cos(Angle), Math.sin(Angle)];
                    }
                    Particles.push(NewParticle);
                    Grid.set(CellKey(Tx, Ty, InvPixel), NewParticle);
                }
            }
        }
    } else if (Mouse[5] === 1) {
        const Size = Mouse[4] * Simulation.Pixel;
        const Dx = Snap(Mouse[0] - Size, Simulation.Pixel);
        const Dy = Snap(Mouse[1] - Size, Simulation.Pixel);
        for (let _ = Particles.length - 1; _ >= 0; _--) {
            const P = Particles[_];
            if (P.Position[0] >= Dx && P.Position[0] <= Dx + Size * 2 &&
                P.Position[1] >= Dy && P.Position[1] <= Dy + Size * 2) {
                Grid.delete(CellKey(P.Position[0], P.Position[1], InvPixel));
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