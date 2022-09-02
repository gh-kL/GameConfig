/**
 * @Doc 通用工具
 * @Author kL
 * @Date 2019/3/19 15:07
 */
export class StringUtils {
    /**
     * 字符串格式化
     * 使用示例1：utility.format("{0}击杀了{1}", "A玩家", "B玩家"); // A玩家击杀了B玩家
     * 使用示例2：utility.format("{0}击杀了{1}", ["A玩家", "B玩家"]); // A玩家击杀了B玩家
     * @param {string} pattern 模板
     * @param {*} args 参数
     * @returns
     */
    public static format(pattern: string, ...args: any[]) {
        if (pattern == void 0) return '';
        if (arguments.length > 0) {
            if (arguments.length == 1) {
                return pattern;
            } else if (arguments.length == 2 && typeof (args) == "object") {
                if (!args) return '';
                for (var i = 0; i < args.length; i++) {
                    if (args[i] != null) {
                        var reg = new RegExp("([【{]" + (i) + "[】}])", "g");
                        pattern = pattern.replace(reg, args[i].toString());
                    }
                }
            } else {
                for (var i = 1; i < arguments.length; i++) {
                    if (arguments[i] != null) {
                        var reg = new RegExp("([【{]" + (i - 1) + "[】}])", "g");
                        pattern = pattern.replace(reg, arguments[i].toString());
                    }
                }
            }
            return pattern;
        } else {
            return "";
        }
    }

    /**
     * 获取字符串中的整型数字（int）
     * 使用示例：utility.getStrNum("如果有3个苹果，要怎样分给5个人吃呢？"); // [3, 5];
     * @param {string} str
     * @returns
     */
    public static getStrNum(str: string) {
        let result: number[] = [];
        let matchs: string[] = str.match(/\d+/g) as string[];
        if (matchs) {
            matchs.forEach(val => {
                result.push(+val);
            });
            return result.length == 1 ? result[0] : result;
        }
    }

    /**
     * 转换到小驼峰命名
     * @param str 
     * @param withUnderline 是否携带下划线
     * @returns 
     */
    public static convertToLowerCamelCase(str: string, withUnderline: boolean = false) {
        str = this.convertToNoUnderline(str);
        return (withUnderline ? "_" : "") + str[0].toLowerCase() + str.substring(1, str.length);
    }

    /**
     * 转换到大驼峰命名
     * @param {string} str
     * @returns
     */
    public static convertToUpperCamelCase(str) {
        str = this.convertToNoUnderline(str);
        return str[0].toUpperCase() + str.substring(1, str.length);
    }

    /**
     * 转换成无下划线命名
     * @param {string} str
     * @returns
     */
    public static convertToNoUnderline(str) {
        var result = str;
        if (str.indexOf("_") >= 0) {
            result = "";
            var clips = str.split("_");
            for (let n = 0; n < clips.length; n++) {
                var clip = clips[n];
                if (n > 0) {
                    result += clip[0].toUpperCase() + clip.substring(1, clip.length);
                } else {
                    result += clip;
                }
            }
        }
        return result;
    }

    /**
     * 生成密码字符串
     * 33~47：!~/
     * 48~57：0~9
     * 58~64：:~@
     * 65~90：A~Z
     * 91~96：[~`
     * 97~122：a~z
     * 123~127：{~
     * @param length 长度
     * @param hasNum 是否包含数字 1-包含 0-不包含
     * @param hasChar 是否包含字母 1-包含 0-不包含
     * @param hasSymbol 是否包含其他符号 1-包含 0-不包含
     * @param caseSense 是否大小写敏感 1-敏感 0-不敏感
     * @param lowerCase 是否只需要小写，只有当hasChar为0且caseSense为1时起作用 1-全部小写 0-全部大写
     */
    public static genPassword(length: number = 8, hasNum: boolean = true, hasChar: boolean = true, hasSymbol: boolean = false, caseSense: boolean = true, lowerCase: boolean = false) {
        var m = "";
        if (!hasNum && !hasChar && !hasSymbol)
            return m;
        for (var i = length; i >= 0; i--) {
            var num = Math.floor((Math.random() * 94) + 33);
            if (
                (
                    (!hasNum) && ((num >= 48) && (num <= 57))
                ) || (
                    (!hasChar) && ((
                        (num >= 65) && (num <= 90)
                    ) || (
                            (num >= 97) && (num <= 122)
                        ))
                ) || (
                    (!hasSymbol) && ((
                        (num >= 33) && (num <= 47)
                    ) || (
                            (num >= 58) && (num <= 64)
                        ) || (
                            (num >= 91) && (num <= 96)
                        ) || (
                            (num >= 123) && (num <= 127)
                        ))
                )
            ) {
                i++;
                continue;
            }
            m += String.fromCharCode(num);
        }
        if (caseSense != null && !caseSense) {
            m = (!lowerCase) ? m.toUpperCase() : m.toLowerCase();
        }
        return m;
    }
}