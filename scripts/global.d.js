const TypeList = document.querySelector(".TypeList");
const Selector = document.querySelector(".Selector");

const Canvas = document.querySelector(".Canvas");
/** @type {CanvasRenderingContext2D} */
const Ctx = Canvas.getContext("2d");
Canvas.setAttribute("width", window.innerWidth);
Canvas.setAttribute("height", window.innerHeight);

const Simulation = {
    Timescale: 1,
    Pixel: 8
};

const Particles = [];
const Mouse = [0, 0, false];

let Selected = "LAVA";

const UpdateInterval = 125;
let LastTime = performance.now();
let RefreshRate = 60;
let FrameCount = 0;
let Framerate = 0;

Types.forEach(Type => {
    const TypeName = Type[0];
    const TypeIcon = Type[1];

    const TypeElement = document.createElement("div");
    TypeElement.classList.add(TypeName);
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
            })
        
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

document.addEventListener("mousedown", () => Mouse[2] = true);
document.addEventListener("mouseup", () => Mouse[2] = false);

document.addEventListener("wheel", (Event) => {
    Event.preventDefault();
    const Delta = Event.deltaY < 0 ? 0.25 : -0.25;
    Simulation.Timescale = Math.min(4, Math.max(0.25, Simulation.Timescale + Delta));
}, { passive: false });

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

    for (const Particle of Particles) {
        for (let _ = 1; _ <= Math.floor(Math.min(1, Math.abs(Particle.Temperature / Particle.Melt)) * 2); _++) {
            const Array = RgbaToArray(Particle.Color);
            Ctx.fillStyle = `rgba(${Array[0]}, ${Array[1]}, ${Array[2]}, 0.0125)`;
            const Size = Simulation.Pixel + (_ * Simulation.Pixel * 2);
            const Offset = (Size - Simulation.Pixel) / 2;
            
            Ctx.fillRect(
                Particle.Position[0] - Offset, Particle.Position[1] - Offset,
                Size, Size
            );
        }
    }

    for (const Particle of Particles) {
        Ctx.fillStyle = Particle.Color;
        Ctx.fillRect(
            Particle.Position[0],
            Particle.Position[1],
            Simulation.Pixel,
            Simulation.Pixel
        );
    }
};

const Simulate = () => {
    const Steps = Math.floor(Simulation.Timescale);
    const Remainder = Simulation.Timescale - Steps;
    const ShouldMove = Math.random() < Remainder ? 1 : 0;
    const TotalSteps = Steps + ShouldMove;

    for (let Step = 0; Step < TotalSteps; Step++) {
        for (const Part0 of Particles) {
            if (Part0.Temperature > Part0.Melt) {
                Part0.Type = Part0.Molten;
            }

            if (Part0.Temperature > 22) {
                Part0.Temperature -= 0.1;
            }

            const Neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(Offset => [
                Part0.Position[0] + Offset[0] * Simulation.Pixel,
                Part0.Position[1] + Offset[1] * Simulation.Pixel
            ]);

            for (const NeighborPos of Neighbors) {
                const Part1 = Particles.find(P => P.Position[0] === NeighborPos[0] && P.Position[1] === NeighborPos[1]);
                if (Part1 && Math.abs(Part0.Temperature - Part1.Temperature) >= 0.25) {
                    const Average = (Part0.Temperature + Part1.Temperature) / 2;
                    Part0.Temperature = Average;
                    Part1.Temperature = Average;
                }
            }

            if (Part0.Type === "Solid") continue;

            const Below = [Part0.Position[0], Part0.Position[1] + Simulation.Pixel];
            const BelowLeft = [Part0.Position[0] - Simulation.Pixel, Part0.Position[1] + Simulation.Pixel];
            const BelowRight = [Part0.Position[0] + Simulation.Pixel, Part0.Position[1] + Simulation.Pixel];
            const Left = [Part0.Position[0] - Simulation.Pixel, Part0.Position[1]];
            const Right = [Part0.Position[0] + Simulation.Pixel, Part0.Position[1]];
            const Above = [Part0.Position[0], Part0.Position[1] - Simulation.Pixel];

            const HasPart = (Pos) => Particles.some(P => P.Position[0] === Pos[0] && P.Position[1] === Pos[1]);

            if (Part0.Type === "Powder") {
                if (Part0.Position[1] < window.innerHeight - Simulation.Pixel) {
                    if (!HasPart(Below)) {
                        Part0.Position[1] += Simulation.Pixel;
                    } else {
                        const LeftOpen = !HasPart(BelowLeft) && Part0.Position[0] > 0;
                        const RightOpen = !HasPart(BelowRight) && Part0.Position[0] < window.innerWidth - Simulation.Pixel;

                        if (LeftOpen && RightOpen) {
                            Part0.Position[0] += Math.random() > 0.5 ? Simulation.Pixel : -Simulation.Pixel;
                            Part0.Position[1] += Simulation.Pixel;
                        } else if (LeftOpen) {
                            Part0.Position[0] -= Simulation.Pixel;
                            Part0.Position[1] += Simulation.Pixel;
                        } else if (RightOpen) {
                            Part0.Position[0] += Simulation.Pixel;
                            Part0.Position[1] += Simulation.Pixel;
                        }
                    }
                }
            } else if (Part0.Type === "Liquid") {
                if (Part0.Position[1] < window.innerHeight - Simulation.Pixel && !HasPart(Below)) {
                    Part0.Position[1] += Simulation.Pixel;
                } else {
                    const LeftOpen = !HasPart(Left) && Part0.Position[0] > 0;
                    const RightOpen = !HasPart(Right) && Part0.Position[0] < window.innerWidth - Simulation.Pixel;

                    if (LeftOpen && RightOpen) {
                        Part0.Position[0] += Math.random() > 0.5 ? Simulation.Pixel : -Simulation.Pixel;
                    } else if (LeftOpen) {
                        Part0.Position[0] -= Simulation.Pixel;
                    } else if (RightOpen) {
                        Part0.Position[0] += Simulation.Pixel;
                    }
                }
            } else if (Part0.Type === "Gas") {
                if (Part0.Position[1] > 0 && !HasPart(Above)) {
                    Part0.Position[1] -= Simulation.Pixel;
                } else {
                    const LeftOpen = !HasPart(Left) && Part0.Position[0] > 0;
                    const RightOpen = !HasPart(Right) && Part0.Position[0] < window.innerWidth - Simulation.Pixel;

                    if (LeftOpen && RightOpen) {
                        Part0.Position[0] += Math.random() > 0.5 ? Simulation.Pixel : -Simulation.Pixel;
                    } else if (LeftOpen) {
                        Part0.Position[0] -= Simulation.Pixel;
                    } else if (RightOpen) {
                        Part0.Position[0] += Simulation.Pixel;
                    }
                }
            }
        }
    }
};

const Update = () => {
    const CurrentTime = performance.now();
    const ElapsedTime = CurrentTime - LastTime;

    const HoveringParticle = Particles.find(
        Particle => Particle.Position[0] === Snap(Mouse[0], Simulation.Pixel) && Particle.Position[1] === Snap(Mouse[1], Simulation.Pixel)
    );
    document.querySelector(".PartStats").style.opacity = HoveringParticle ? "1" : "0";
    if (Mouse[2]) {
        const Properties = Elements.find(Element => Element.Name === Selected);
        if (Properties && !HoveringParticle) {
            const NewParticle = {
                ...Properties,
                Position: [Snap(Mouse[0], Simulation.Pixel), Snap(Mouse[1], Simulation.Pixel)],
                Temperature: Properties.Temperature || 22
            };
            const Array = RgbaToArray(Properties.Color);
            NewParticle.Color = `rgb(
                ${Clamp(Array[0] + RandomNumber(-16, 16), 0, 255)},
                ${Clamp(Array[1] + RandomNumber(-16, 16), 0, 255)},
                ${Clamp(Array[2] + RandomNumber(-16, 16), 0, 255)}
            )`;
            Particles.push(NewParticle);
        }
    } else if (HoveringParticle) {
        document.querySelector(".PartStats").innerHTML =
        `<div class="Name">${HoveringParticle.Name}</div>,
        <div style="background-color: ${HoveringParticle.Color};" class="Color"></div>,
        <div class="Temp">${HoveringParticle.Temperature.toFixed(1)}⁰C</div>`;
    }

    document.querySelector(".Cursor").setAttribute("style", `
        left: ${Snap(Mouse[0], Simulation.Pixel)}px;
        top: ${Snap(Mouse[1], Simulation.Pixel)}px;
        width: ${Simulation.Pixel}px;
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

    document.querySelector(".Particles").innerHTML = `Particles: ${Particles.length}`;
    document.querySelector(".Timescale").innerHTML = `Timescale: ${Simulation.Timescale.toFixed(2)}x`;
    
    Simulate();
    Draw();

    requestAnimationFrame(Update);
};

Update();