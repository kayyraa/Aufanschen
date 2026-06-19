globalThis.Elements = [
    {
        Name: "WATR",
        Type: "Liquid",
        Color: "rgb(75, 75, 200)",
        Molten: "Gas",
        Cold: "Liquid",
        Melt: 100
    },
    {
        Name: "OIL",
        Type: "Liquid",
        Color: "rgb(64, 64, 16)",
        Molten: "Gas",
        Cold: "Liquid",
        Melt: 160,
        Flammable: [
            true,
            ["SMKE", "FIRE", "CO2"],
            150
        ],
    },
    {
        Name: "LN2",
        Type: "Liquid",
        Color: "rgb(150, 150, 200)",
        Molten: "Gas",
        Cold: "Liquid",
        Temperature: -203,
        Melt: -202
    },
    {
        Name: "MERC",
        Type: "Liquid",
        Color: "rgb(180, 180, 180)",
        Molten: "Liquid",
        Cold: "Liquid",
        Melt: -39
    },
    {
        Name: "LAVA",
        Type: "Liquid",
        Color: "rgb(255, 0, 0)",
        Molten: "Liquid",
        Cold: "&STNE",
        Temperature: 2400,
        Freeze: 250,
        Melt: 600
    },
    {
        Name: "NITR",
        Type: "Explosive, Liquid",
        Color: "rgb(50, 255, 50)",
        Molten: "Explosive, Liquid",
        Cold: "Explosive, Liquid",
        Melt: 75
    },
    {
        Name: "IRON",
        Type: "Solid",
        Color: "rgb(100, 100, 100)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 1500
    },
    {
        Name: "TTAN",
        Type: "Solid",
        Color: "rgb(120, 120, 120)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 1800
    },
    {
        Name: "TIN",
        Type: "Solid",
        Color: "rgb(90, 90, 90)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 400
    },
    {
        Name: "GLAS",
        Type: "Solid",
        Color: "rgb(90, 90, 90)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 1600
    },
    {
        Name: "LEAD",
        Type: "Solid",
        Color: "rgb(100, 100, 100)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 327,
        Shield: true
    },
    {
        Name: "CALC",
        Type: "Solid",
        Color: "rgb(140, 140, 140)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 842,
        Reactive: [
            15,
            ["WATR"],
            ["STNE", "SPRK", "PLSM", "WTRV"]
        ]
    },
    {
        Name: "GALI",
        Type: "Solid",
        Color: "rgb(160, 160, 160)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 36,
        Reactive: [
            15,
            ["ALUM"],
            [],
            [true, 5000]
        ]
    },
    {
        Name: "COAL",
        Type: "Solid",
        Color: "rgb(75, 75, 75)",
        Molten: "Solid",
        Cold: "Solid",
        Flammable: [
            true,
            ["FIRE", "SMKE", "CO2"],
            300
        ],
        Melt: Number.MAX_SAFE_INTEGER
    },
    {
        Name: "ALUM",
        Type: "Solid",
        Color: "rgb(100, 100, 100)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 720
    },
    {
        Name: "GOLD",
        Type: "Solid",
        Color: "rgb(200, 200, 100)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 900
    },
    {
        Name: "DMND",
        Type: "Solid",
        Color: "rgb(55, 200, 200)",
        Molten: "Liquid",
        Cold: "Solid",
        Melt: 3200
    },
    {
        Name: "ICE",
        Type: "Solid",
        Color: "rgb(200, 220, 255)",
        Molten: "Liquid",
        Cold: "Solid",
        Temperature: -10,
        Melt: 0
    },
    {
        Name: "DUST",
        Type: "Powder",
        Color: "rgb(220, 220, 200)",
        Molten: "Powder",
        Cold: "Powder",
        Melt: Number.MAX_SAFE_INTEGER
    },
    {
        Name: "SAND",
        Type: "Powder",
        Color: "rgb(220, 220, 180)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 700
    },
    {
        Name: "STNE",
        Type: "Powder",
        Color: "rgb(220, 220, 220)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 400
    },
    {
        Name: "SALT",
        Type: "Powder",
        Color: "rgb(240, 240, 240)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 1250
    },
    {
        Name: "BCOL",
        Type: "Powder",
        Color: "rgb(90, 90, 90)",
        Molten: "Powder",
        Cold: "Powder",
        Melt: Number.MAX_SAFE_INTEGER,
        Flammable: [
            true,
            ["FIRE", "SMKE", "CO2"],
            750
        ]
    },
    {
        Name: "ROCK",
        Type: "Powder",
        Color: "rgb(80, 80, 80)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 500
    },
    {
        Name: "LITH",
        Type: "Powder",
        Color: "rgb(140, 140, 140)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 120,
        Reactive: [
            120,
            ["WATR"],
            ["HYGN", "WTRV"]
        ]
    },
    {
        Name: "SNOW",
        Type: "Powder",
        Color: "rgb(200, 220, 255)",
        Molten: "WATR",
        Cold: "Powder",
        Temperature: -10,
        Melt: 0
    },
    {
        Name: "URAN",
        Type: "Radioactive, Powder",
        Color: "rgb(112, 112, 32)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 600,
        Life: "50000000",
    },
    {
        Name: "PLUT",
        Type: "Radioactive, Powder",
        Color: "rgb(112, 150, 32)",
        Molten: "Liquid",
        Cold: "Powder",
        Melt: 600,
        Life: "500000",
    },
    {
        Name: "DEUT",
        Type: "Radioactive, Liquid",
        Color: "rgb(112, 112, 255)",
        Molten: "Liquid",
        Cold: "Liquid",
        Melt: Number.MAX_SAFE_INTEGER,
        Life: "50000",
    },
    {
        Name: "FIRE",
        Type: "Gas",
        Color: "rgb(255, 50, 50)",
        Molten: "Gas",
        Cold: "Gas",
        Temperature: 2200,
        Melt: 0,
        Incendiary: true,
        Life: "500",
    },
    {
        Name: "CO2",
        Type: "Gas",
        Color: "rgb(70, 70, 70)",
        Molten: "Gas",
        Cold: "Gas",
        Melt: 0,
        Life: "500",
    },
    {
        Name: "SMKE",
        Type: "Gas",
        Color: "rgb(50, 50, 50)",
        Molten: "Gas",
        Cold: "Gas",
        Temperature: 800,
        Melt: 0,
        Life: "500",
    },
    {
        Name: "WTRV",
        Type: "Gas",
        Color: "rgb(100, 100, 200)",
        Molten: "Gas",
        Cold: "Liquid",
        Temperature: 100,
        Melt: 95
    },
    {
        Name: "OXYG",
        Type: "Gas",
        Color: "rgb(100, 100, 200)",
        Molten: "Gas",
        Cold: "Gas",
        Temperature: -183,
        Melt: 0
    },
    {
        Name: "HYGN",
        Type: "Liquid, Gas",
        Color: "rgb(120, 120, 240)",
        Molten: "Gas",
        Cold: "Liquid",
        Temperature: -183,
        Melt: -184,
        Flammable: [
            true,
            ["FIRE", "NONE"],
            50
        ],
    },
    {
        Name: "SPRK",
        Type: "Gas",
        Color: "rgb(255, 255, 100)",
        Molten: "Gas",
        Cold: "Gas",
        Temperature: 10000,
        Melt: 0,
        Incendiary: true,
        Life: "500",
    },
    {
        Name: "PLSM",
        Type: "Gas",
        Color: "rgb(255, 100, 255)",
        Molten: "Gas",
        Cold: "Gas",
        Temperature: 10000,
        Melt: 0,
        Incendiary: true,
        Life: "500",
    },
    {
        Name: "NEUT",
        Type: "Radioactive, Light",
        Color: "rgb(0, 200, 255)",
        Life: "700",
        Reactive: [
            360,
            ["DEUT"],
            ["NEUT"]
        ]
    },
    {
        Name: "PROT",
        Type: "Radioactive, Light",
        Color: "rgb(255, 55, 0)",
        Life: "500",
    },
    {
        Name: "PHOT",
        Type: "Radioactive, Light",
        Color: "rgb(255, 255, 255)",
        Life: "500",
    },
    {
        Name: "NONE",
        Type: "None, Powder",
        Color: "rgb(0, 0, 0)",
        Life: 0
    },
    {
        Name: "VOID",
        Type: "None",
        Color: "rgb(255, 75, 75)"
    },
    {
        Name: "PRTI",
        Type: "None",
        Color: "rgb(255, 155, 0)",
        Temperature: 0,
        Loop: [true, true]
    },
    {
        Name: "PRTO",
        Type: "None",
        Color: "rgb(155, 155, 255)",
        Temperature: 0,
        Loop: [false, true]
    },
    {
        Name: "CLNE",
        Type: "None",
        Color: "rgb(255, 255, 155)",
        Temperature: 0,
        Clone: undefined
    },
    {
        Name: "STND",
        Type: "None",
        Color: "rgb(255, 255, 255)",
        Temperature: 0,
        Clone: undefined
    }
];

globalThis.Types = [
    [
        "Liquid",
        "../images/Liquid.svg"
    ],
    [
        "Solid",
        "../images/Solid.svg"
    ],
    [
        "Powder",
        "../images/Powder.svg"
    ],
    [
        "Gas",
        "../images/Gas.png"
    ],
    [
        "Radioactive",
        "../images/Radioactive.svg"
    ],
    [
        "None",
        "../images/None.svg"
    ],
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