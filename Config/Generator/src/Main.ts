import { DataModel } from "./DataModel";
import { GenOriginModule } from "./genModules/GenOriginModule";
import cli from "cli-color";
import uglifyjs from "uglify-js";
import { GenTSModule } from "./genModules/GenTSModule";
import { GenCSModule } from "./genModules/GenCSModule";
import { IOUtils } from "./utils/IOUtils";
import fs from "fs";
import path from "path";
import { CodeLanguageEnum } from "./CodeLanguageEnum";

DataModel.Instance.reset();
let genResult = GenOriginModule.Instance.gen();

if (genResult) {
    let exportArray = DataModel.Instance.config.exports;

    for (let n = 0; n < exportArray.length; n++) {
        const expt = exportArray[n];

        if (!expt.enabled)
            continue;

        // 判断导出路径是否存在
        let configDir = path.dirname(expt.export_url);
        if (!IOUtils.fileOrFolderIsExsit(expt.export_script_url)) {
            if (expt.force_make_dir) {
                IOUtils.makeDir(expt.export_script_url);
            } else {
                console.log(cli.yellow(`${expt.id} 发布失败，路径不存在：${expt.export_script_url}`));
                continue;
            }
        }
        if (!IOUtils.fileOrFolderIsExsit(configDir)) {
            if (expt.force_make_dir) {
                IOUtils.makeDir(configDir);
            } else {
                console.log(cli.yellow(`${expt.id} 发布失败，路径不存在：${configDir}`));
                continue;
            }
        }

        DataModel.Instance.reset();

        switch (expt.code_language) {
            case CodeLanguageEnum.CS:{
                genResult = GenCSModule.Instance.gen(expt.id);
                break;
            }
            case CodeLanguageEnum.TS:{
                genResult = GenTSModule.Instance.gen(expt.id);
                break;
            }
            default:{
                console.log(cli.red(`${expt.id} 发布失败，路径不存在：${configDir}`));
                break;
            }
        }

        if (!genResult) {
            break;
        }
    }
}

// ---------------------------- began 丑化编译代码 ----------------------------
let jsFiles: string[] = [];
IOUtils.findFile("dist", [".js", ".JS"], jsFiles);
for (let n = jsFiles.length - 1; n >= 0; n--) {
    let jsFile = jsFiles[n];
    let jsCode = fs.readFileSync(jsFile, { encoding: "utf-8" });
    let option = {
        mangle: {
            toplevel: true,
        },
    };
    let result = uglifyjs.minify(jsCode, option);
    if (jsCode != result.code) {
        IOUtils.writeTextFile(jsFile, result.code);
    } else {
        break;
    }
}
// ---------------------------- ended 丑化编译代码 ----------------------------

if (genResult) {
    console.log(cli.green("\n<<< 所有配置发布完成！>>>"));
} else {
    console.log(cli.yellow("发布配置失败，发布配置过程中出现错误！请向上翻看是否有报错信息。"));
}