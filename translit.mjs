
const toString = Object.prototype.toString;

function invert(object) {
    const result = {}
    Object.keys(object).forEach((key) => {
        let value = object[key]
        if (value != null && typeof value.toString !== 'function') {
        value = toString.call(value)
        }
        result[value] = key
    })
    return result;
}





function getConsts (preset) {
    const _preset = preset || "ru";


    const _firstLetters = {
        "а": "a",
        "б": "b",
        "в": "v",
        "д": "d",
        "з": "z",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "ь": ""
    };
    
    // language-specific letters
    if (_preset === "ru") {
        Object.assign(_firstLetters, {
        "г": "g",
        "и": "i",
        "ъ": "",
        "ы": "i",
        "э": "e",
        });
    } else if (_preset === "uk") {
        Object.assign(_firstLetters, {
        "г": "h",
        "ґ": "g",
        "е": "e",
        "и": "y",
        "і": "i",
        "'": "",
        "’": "",
        "ʼ": "",
        })
    } else if (_preset === "mn") {
        Object.assign(_firstLetters, {
        "г": "g",
        "ө": "o",
        "ү": "u",
        "и": "i",
        "ы": "y",
        "э": "e",
        "ъ": ""
        })
    }
    
    let _reversedFirstLetters;
    if (_preset === "ru") {
        // Russian: i > always и, y > й in initial position, e > э in initial position
        _reversedFirstLetters = Object.assign(invert(_firstLetters), { "i": "и", "": "" });
    } else if (_preset === "uk") {
        // Ukrainian: i > always i, y > always и, e > always е
        _reversedFirstLetters = Object.assign(invert(_firstLetters), { "": "" });
    } else if (_preset === "mn") {
        _reversedFirstLetters = Object.assign(invert(_firstLetters), { "": "" });
    }
    
    // digraphs appearing only in initial position
    const _initialDigraphs = (_preset === "ru") ? { "е": "ye" } : { "є": "ye", "ї": "yi" };
    
    // digraphs appearing in all positions
    const _regularDigraphs = {
        "ё": "yo",
        "ж": "zh",
        "х": "kh",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "shch",
        "ю": "yu",
        "я": "ya",
    }
    
    const _firstDigraphs = Object.assign({}, _regularDigraphs, _initialDigraphs);
    
    const _reversedFirstDigraphs = Object.assign(invert(_firstDigraphs));
    
    const _firstAssociations = Object.assign(_firstLetters, _firstDigraphs);
    
    /*
    ASSOCIATIONS FOR NON-INITIAL POSITION
    */
    
    const _nonFirstLetters = Object.assign({}, _firstLetters, { "й": "i" });
    if (_preset === "ru") {
        Object.assign(_nonFirstLetters, { "е": "e" });
    } else if (_preset === "uk") {
        Object.assign(_nonFirstLetters, { "ї": "i" });
    } else if (_preset === "mn") {
        Object.assign(_nonFirstLetters, { "е": "e" });
    }
    
    let _reversedNonFirstLetters;
    if (_preset === "ru") {
        // Russian: i > always и, y > ы in non-initial position, e > е in non-initial position
        _reversedNonFirstLetters = Object.assign(invert(_firstLetters), {
        "i": "и", 
        "y": "ы",
        "e": "е",
        "": "" 
        });
    } else if (_preset === "uk") {
        // Ukrainian: i > always i, y > always и, e > always е
        _reversedNonFirstLetters = Object.assign(invert(_firstLetters), { "": "" });
    }
    
    // digraphs appearing only in non-initial positions
    let _nonInitialDigraphs = {};
    if (_preset === "uk") {
        _nonInitialDigraphs = {
        "є": "ie",
        "ю": "iu",
        "я": "ia",
        };
    }
    
    const _nonFirstDigraphs = Object.assign(_regularDigraphs, _nonInitialDigraphs);
    
    const _reversedNonFirstDigraphs = Object.assign(invert(_nonFirstDigraphs));
    
    const _nonFirstAssociations = Object.assign(_nonFirstLetters, _nonFirstDigraphs);

    return {
        _preset,
        _firstLetters,
        _nonFirstLetters,
        _regularDigraphs,
        _nonFirstDigraphs,
        _nonInitialDigraphs,
        _nonFirstAssociations,
        _reversedNonFirstDigraphs,
        _reversedNonFirstLetters,
        _reversedFirstDigraphs,
        _firstAssociations,
    };
}




export function transform({input, spaceReplacement, preset = "ru"} = {}) {
    if (!input) {
    return "";
    }

    const {
        _preset,
        _firstLetters,
        _nonFirstLetters,
        _regularDigraphs,
        _nonFirstDigraphs,
        _nonInitialDigraphs,
        _nonFirstAssociations,
        _reversedNonFirstDigraphs,
        _reversedNonFirstLetters,
        _reversedFirstDigraphs,
        _firstAssociations,
    } =  getConsts(preset);

    // We must normalize string for transform all unicode chars to uniform form
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
    const normalizedInput = input.normalize();

    let newStr = "";
    let isWordBoundary = false;

    for (let i = 0; i < normalizedInput.length; i++) {
    const isUpperCaseOrWhatever = normalizedInput[i] === normalizedInput[i].toUpperCase();
    let strLowerCase = normalizedInput[i].toLowerCase();

    if (strLowerCase === " ") {
        newStr += spaceReplacement ? spaceReplacement :  " ";
        isWordBoundary = true;
        continue;
    }

    let newLetter;

    if ( _preset === "uk" && normalizedInput.slice(i-1, i+1).toLowerCase() === "зг") {
        // handle ukrainian special case зг > zgh
        newLetter = "gh";
    } else if (i === 0 || isWordBoundary) {
        newLetter = _firstAssociations[strLowerCase];
        isWordBoundary = false;
    } else {
        newLetter = _nonFirstAssociations[strLowerCase];
    }

    if ("undefined" === typeof newLetter) {
        newStr += isUpperCaseOrWhatever ? strLowerCase.toUpperCase() : strLowerCase;
    } else if (isUpperCaseOrWhatever) {
        // handle multi-symbol letters
        newLetter.length > 1
        ? newStr += newLetter[0].toUpperCase() + newLetter.slice(1)
        : newStr += newLetter.toUpperCase();
    } else {
        newStr += newLetter;
    }
    }
    return newStr;
}

export function reverse ({input, spaceReplacement, preset = "ru"} = {}) {

    if (!input) return "";

    const {
        _preset,
        _firstLetters,
        _nonFirstLetters,
        _regularDigraphs,
        _nonFirstDigraphs,
        _nonInitialDigraphs,
        _nonFirstAssociations,
        _reversedNonFirstDigraphs,
        _reversedNonFirstLetters,
        _reversedFirstDigraphs,
        _firstAssociations,
    } =  getConsts(preset);

    const normalizedInput = input.normalize();

    let newStr = "";
    let isWordBoundary = false;
    let i = 0;

    while (i < normalizedInput.length) {
    const isUpperCaseOrWhatever = normalizedInput[i] === normalizedInput[i].toUpperCase();
    let strLowerCase = normalizedInput[i].toLowerCase();
    let currentIndex = i;

    if (strLowerCase === " " || strLowerCase === spaceReplacement) {
        newStr += " ";
        isWordBoundary = true;
        i++;
        continue;
    }
    
    let newLetter;

    let digraph = normalizedInput.slice(i, i + 2).toLowerCase();
    if (i === 0 || isWordBoundary) {
        newLetter = _reversedFirstDigraphs[digraph];
        if (newLetter) {
        i += 2;
        } else {
        newLetter = _reversedFirstLetters[strLowerCase];
        i++;
        }
        isWordBoundary = false;
    } else {
        newLetter = _reversedNonFirstDigraphs[digraph];
        if (newLetter) {
        i += 2;
        } else {
        newLetter = _reversedNonFirstLetters[strLowerCase];
        i++;
        }
    }

    // special cases: щ and зг
    if (normalizedInput.slice(currentIndex, currentIndex + 4).toLowerCase() === "shch") {
        newLetter = "щ";
        i = currentIndex + 4;
    } else if (normalizedInput.slice(currentIndex - 1, currentIndex + 2).toLowerCase() === "zgh") {
        newLetter = "г";
        i = currentIndex + 2;
    }

    if ("undefined" === typeof newLetter) {
        newStr += isUpperCaseOrWhatever ? strLowerCase.toUpperCase() : strLowerCase;
    }
    else {
        if (isUpperCaseOrWhatever) {
            // handle multi-symbol letters
            newLetter.length > 1
            ? newStr += newLetter[0].toUpperCase() + newLetter.slice(1)
            : newStr += newLetter.toUpperCase();
        } else {
            newStr += newLetter;
        }
    }
    }

    return newStr;
}
