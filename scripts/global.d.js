const TypeList = document.querySelector(".TypeList");
const Selector = document.querySelector(".Selector");

const Canvas = document.querySelector(".Canvas");
/** @type {CanvasRenderingContext2D} */
const Ctx = Canvas.getContext("2d");
Canvas.setAttribute("width", window.innerWidth);
Canvas.setAttribute("height", window.innerHeight);

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
    Ctx.clearRect(0, 0, Canvas.width, Canvas.height);

    if (Simulation.ShowPressure) {
        const PressureCell = Simulation.Pixel * 4;
        Simulation.PressureGrid.forEach((Count, Key) => {
            if (Count <= 0) return;
            const [Gx, Gy] = Key.split(",").map(Number);
            const Alpha = Math.min(1, Count / 16);
            Ctx.fillStyle = `rgba(0, 120, 255, ${Alpha * 0.35})`;
            Ctx.fillRect(Gx * PressureCell, Gy * PressureCell, PressureCell, PressureCell);
        });
    }

    for (const Particle of Particles) {
        for (let _ = 1; _ <= Math.floor(Math.min(1, Math.abs(Particle.Temperature / Particle.Melt)) * 2); _++) {
            const Arr = RgbaToArray(Particle.Color);
            Ctx.fillStyle = `rgba(${Arr[0]}, ${Arr[1]}, ${Arr[2]}, 0.0125)`;
            const Size = Simulation.Pixel + (_ * Simulation.Pixel * 2);
            const Offset = (Size - Simulation.Pixel) / 2;
            Ctx.fillRect(
                Particle.Position[0] - Offset, Particle.Position[1] - Offset,
                Size, Size
            );
        }
    }

    for (const Particle of Particles) {
        const Element = Elements.find(E => E.Name == Particle.Name);
        const Array = RgbaToArray(Particle.Color);
        Ctx.fillStyle = `rgb(
            ${Math.min(255, Math.max(Math.max(0, Array[0] / 4), Array[0] + (Particle.Temperature - (Element ? Element.Temperature : 22) || 22)))},
            ${Array[1]},
            ${Array[2]}
        )`;
        Ctx.fillRect(
            Particle.Position[0], Particle.Position[1],
            Simulation.Pixel, Simulation.Pixel
        );
    }
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

Update();