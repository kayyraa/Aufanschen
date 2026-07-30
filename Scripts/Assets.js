const Defaults = {
    Type: "None",
    Color: "rgb(128,128,128)",
    Molten: null,
    Cold: null,
    Temperature: 20,
    Melt: Number.MaxSafeInteger,
    Freeze: null,
    Life: null,
    Incendiary: false,
    Shield: false,
    Flammable: null,
    Reactive: null,
    Loop: null,
    Clone: undefined
};

function Ex(Name, Overrides = {}) {
    return {
        Name: Name,
        ...Defaults,
        ...Overrides,
        Molten: Overrides.Molten ?? Overrides.Type ?? Defaults.Molten,
        Cold: Overrides.Cold ?? Overrides.Type ?? Defaults.Cold
    };
}

function Flammable(Products, Chance) {
    return { Products, Chance };
}

function Reactive(Chance, With, Products = [], Extra = null) {
    return { Chance, With, Products, Extra };
}

globalThis.Elements = {
    Watr: Ex("Watr", {
        Type: "Liquid",
        Color: "rgb(75, 75, 200)",
        Molten: "Gas",
        Melt: 100
    }),
    Oil: Ex("Oil", {
        Type: "Liquid",
        Color: "rgb(64, 64, 16)",
        Molten: "Gas",
        Melt: 160,
        Flammable: Flammable(["Smke", "Fire", "Co2"], 150)
    }),
    Ln2: Ex("Ln2", {
        Type: "Liquid",
        Color: "rgb(150, 150, 200)",
        Molten: "Gas",
        Temperature: -203,
        Melt: -202
    }),
    Merc: Ex("Merc", {
        Type: "Liquid",
        Color: "rgb(180, 180, 180)",
        Melt: -39
    }),
    Lava: Ex("Lava", {
        Type: "Liquid",
        Color: "rgb(255, 0, 0)",
        Cold: "Stne",
        Temperature: 2400,
        Freeze: 250,
        Melt: 600
    }),
    Nitr: Ex("Nitr", {
        Type: "Explosive, Liquid",
        Color: "rgb(50, 255, 50)",
        Melt: 75
    }),
    Iron: Ex("Iron", {
        Type: "Solid",
        Color: "rgb(100, 100, 100)",
        Molten: "Liquid",
        Melt: 1500
    }),
    Ttan: Ex("Ttan", {
        Type: "Solid",
        Color: "rgb(120, 120, 120)",
        Molten: "Liquid",
        Melt: 1800
    }),
    Tin: Ex("Tin", {
        Type: "Solid",
        Color: "rgb(90, 90, 90)",
        Molten: "Liquid",
        Melt: 400
    }),
    Glas: Ex("Glas", {
        Type: "Solid",
        Color: "rgb(90, 90, 90)",
        Molten: "Liquid",
        Melt: 1600
    }),
    Lead: Ex("Lead", {
        Type: "Solid",
        Color: "rgb(100, 100, 100)",
        Molten: "Liquid",
        Melt: 327,
        Shield: true
    }),
    Calc: Ex("Calc", {
        Type: "Solid",
        Color: "rgb(140, 140, 140)",
        Molten: "Liquid",
        Melt: 842,
        Reactive: Reactive(15, ["Watr"], ["Stne", "Sprk", "Plsm", "Wtrv"])
    }),
    Gali: Ex("Gali", {
        Type: "Solid",
        Color: "rgb(160, 160, 160)",
        Molten: "Liquid",
        Melt: 36,
        Reactive: Reactive(15, ["Alum"], [], [true, 5000])
    }),
    Coal: Ex("Coal", {
        Type: "Solid",
        Color: "rgb(75, 75, 75)",
        Flammable: Flammable(["Fire", "Smke", "Co2"], 300)
    }),
    Alum: Ex("Alum", {
        Type: "Solid",
        Color: "rgb(100, 100, 100)",
        Molten: "Liquid",
        Melt: 720
    }),
    Gold: Ex("Gold", {
        Type: "Solid",
        Color: "rgb(200, 200, 100)",
        Molten: "Liquid",
        Melt: 900
    }),
    Dmnd: Ex("Dmnd", {
        Type: "Solid",
        Color: "rgb(55, 200, 200)",
        Molten: "Liquid",
        Melt: 3200
    }),
    Ice: Ex("Ice", {
        Type: "Solid",
        Color: "rgb(200, 220, 255)",
        Molten: "Liquid",
        Temperature: -10,
        Melt: 0
    }),
    Dust: Ex("Dust", {
        Type: "Powder",
        Color: "rgb(220, 220, 200)"
    }),
    Sand: Ex("Sand", {
        Type: "Powder",
        Color: "rgb(220, 220, 180)",
        Molten: "Liquid",
        Melt: 700
    }),
    Stne: Ex("Stne", {
        Type: "Powder",
        Color: "rgb(220, 220, 220)",
        Molten: "Liquid",
        Melt: 400
    }),
    Salt: Ex("Salt", {
        Type: "Powder",
        Color: "rgb(240, 240, 240)",
        Molten: "Liquid",
        Melt: 1250
    }),
    Bcol: Ex("Bcol", {
        Type: "Powder",
        Color: "rgb(90, 90, 90)",
        Flammable: Flammable(["Fire", "Smke", "Co2"], 750)
    }),
    Rock: Ex("Rock", {
        Type: "Powder",
        Color: "rgb(80, 80, 80)",
        Molten: "Liquid",
        Melt: 500
    }),
    Lith: Ex("Lith", {
        Type: "Powder",
        Color: "rgb(140, 140, 140)",
        Molten: "Liquid",
        Melt: 120,
        Reactive: Reactive(120, ["Watr"], ["Hygn", "Wtrv"])
    }),
    Snow: Ex("Snow", {
        Type: "Powder",
        Color: "rgb(200, 220, 255)",
        Molten: "Watr",
        Temperature: -10,
        Melt: 0
    }),
    Uran: Ex("Uran", {
        Type: "Radioactive, Powder",
        Color: "rgb(112, 112, 32)",
        Molten: "Liquid",
        Melt: 600,
        Life: 50000000
    }),
    Plut: Ex("Plut", {
        Type: "Radioactive, Powder",
        Color: "rgb(112, 150, 32)",
        Molten: "Liquid",
        Melt: 600,
        Life: 500000
    }),
    Deut: Ex("Deut", {
        Type: "Radioactive, Liquid",
        Color: "rgb(112, 112, 255)",
        Life: 50000
    }),
    Fire: Ex("Fire", {
        Type: "Gas",
        Color: "rgb(255, 50, 50)",
        Temperature: 2200,
        Melt: 0,
        Incendiary: true,
        Life: 500
    }),
    Co2: Ex("Co2", {
        Type: "Gas",
        Color: "rgb(70, 70, 70)",
        Melt: 0,
        Life: 500
    }),
    Smke: Ex("Smke", {
        Type: "Gas",
        Color: "rgb(50, 50, 50)",
        Temperature: 800,
        Melt: 0,
        Life: 500
    }),
    Wtrv: Ex("Wtrv", {
        Type: "Gas",
        Color: "rgb(100, 100, 200)",
        Cold: "Liquid",
        Temperature: 100,
        Melt: 95
    }),
    Oxyg: Ex("Oxyg", {
        Type: "Gas",
        Color: "rgb(100, 100, 200)",
        Temperature: -183,
        Melt: 0
    }),
    Hygn: Ex("Hygn", {
        Type: "Liquid, Gas",
        Color: "rgb(120, 120, 240)",
        Molten: "Gas",
        Cold: "Liquid",
        Temperature: -183,
        Melt: -184,
        Flammable: Flammable(["Fire", "None"], 50)
    }),
    Sprk: Ex("Sprk", {
        Type: "Gas",
        Color: "rgb(255, 255, 100)",
        Temperature: 10000,
        Melt: 0,
        Incendiary: true,
        Life: 500
    }),
    Plsm: Ex("Plsm", {
        Type: "Gas",
        Color: "rgb(255, 100, 255)",
        Temperature: 10000,
        Melt: 0,
        Incendiary: true,
        Life: 500
    }),
    Neut: Ex("Neut", {
        Type: "Radioactive, Light",
        Color: "rgb(0, 200, 255)",
        Life: 700,
        Reactive: Reactive(360, ["Deut"], ["Neut"])
    }),
    Prot: Ex("Prot", {
        Type: "Radioactive, Light",
        Color: "rgb(255, 55, 0)",
        Life: 500
    }),
    Phot: Ex("Phot", {
        Type: "Radioactive, Light",
        Color: "rgb(255, 255, 255)",
        Life: 500
    }),
    None: Ex("None", {
        Type: "None, Powder",
        Color: "rgb(0, 0, 0)",
        Life: 0
    }),
    Void: Ex("Void", {
        Type: "None",
        Color: "rgb(255, 75, 75)"
    }),
    Prti: Ex("Prti", {
        Type: "None",
        Color: "rgb(255, 155, 0)",
        Temperature: 0,
        Loop: [true, true]
    }),
    Prto: Ex("Prto", {
        Type: "None",
        Color: "rgb(155, 155, 255)",
        Temperature: 0,
        Loop: [false, true]
    }),
    Clne: Ex("Clne", {
        Type: "None",
        Color: "rgb(255, 255, 155)",
        Temperature: 0
    }),
    Stnd: Ex("Stnd", {
        Type: "None",
        Color: "rgb(255, 255, 255)",
        Temperature: 0
    })
};

globalThis.Elements = Elements;

function GetElement(Name) {
    const E = Elements[Name];
    if (!E) throw new Error(`Unknown Element: ${Name}`);
    return E;
}

function IsType(Name, Type) {
    return GetElement(Name).Type.split(",").map(T => T.trim()).includes(Type);
}

function IsFlammable(Name) {
    return !!GetElement(Name).Flammable;
}

function IsReactive(Name) {
    return !!GetElement(Name).Reactive;
}

function IsIncendiary(Name) {
    return !!GetElement(Name).Incendiary;
}

globalThis.ElementList = Object.values(Elements);

globalThis.Types = [
    ["Liquid", "../Images/Liquid.svg"],
    ["Solid", "../Images/Solid.svg"],
    ["Powder", "../Images/Powder.svg"],
    ["Gas", "../Images/Gas.png"],
    ["Radioactive", "../Images/Radioactive.svg"],
    ["None", "../Images/None.svg"]
];

globalThis.Snap = (Number, Snap) => Math.round(Number / Snap) * Snap;
globalThis.Clamp = (Number, Min, Max) => Math.min(Math.max(Number, Min), Max);
globalThis.RandomNumber = (Min, Max) => Math.random() * (Max - Min) + Min;
globalThis.RandomInteger = (Min, Max) => Math.floor(RandomNumber(Min, Max + 1));
globalThis.RgbaToArray = (Rgba) => Rgba.match(/[\d.]+/g).map(Number);
globalThis.PowderEffect = (Rgba, Strength) => {
    const Array = RgbaToArray(Rgba);
    return `rgb(
        ${Clamp(Array[0] + RandomInteger(-Strength, Strength), 0, 255)},
        ${Clamp(Array[1] + RandomInteger(-Strength, Strength), 0, 255)}, 
        ${Clamp(Array[2] + RandomInteger(-Strength, Strength), 0, 255)}
    )`;
};

globalThis.FormatNumber = (Number) => {
    return Math.abs(Number) >= 1e15 ? (Number / 1e15).toFixed(1) + 'qt' :
           Math.abs(Number) >= 1e12 ? (Number / 1e12).toFixed(1) + 't' :
           Math.abs(Number) >= 1e9 ? (Number / 1e9).toFixed(1) + 'b' :
           Math.abs(Number) >= 1e6 ? (Number / 1e6).toFixed(1) + 'm' :
           Math.abs(Number) >= 1e3 ? (Number / 1e3).toFixed(1) + 'k' : Number.toString();
};

globalThis.Lerp = (Alpha, Beta, Time) => Alpha + (Beta - Alpha) * Time;