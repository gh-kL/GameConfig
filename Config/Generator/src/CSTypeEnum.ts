/**
 * @Doc CS类型枚举
 * @Author kL
 * @Date 2020/7/12 12:15
 */
export enum CSTypeEnum {
    Bool = "bool",
    Int = "int",
    String = "string",
    Float = "float",

    BoolList = "IReadOnlyList<bool>",
    IntList = "IReadOnlyList<int>",
    StringList = "IReadOnlyList<string>",
    FloatList = "IReadOnlyList<float>",

    BoolList2 = "IReadOnlyList<IReadOnlyList<bool>>",
    IntList2 = "IReadOnlyList<IReadOnlyList<int>>",
    StringList2 = "IReadOnlyList<IReadOnlyList<string>>",
    FloatList2 = "IReadOnlyList<IReadOnlyList<float>>",

    BoolList3 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<bool>>>",
    IntList3 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>>",
    StringList3 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<string>>>",
    FloatList3 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<float>>>",

    BoolList4 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<bool>>>>",
    IntList4 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>>>",
    StringList4 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<string>>>>",
    FloatList4 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<float>>>>",

    BoolList5 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<bool>>>>>",
    IntList5 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>>>>",
    StringList5 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<string>>>>>",
    FloatList5 = "IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<float>>>>>",
}