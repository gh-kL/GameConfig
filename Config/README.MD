# 游戏配置生成工具

在游戏开发中，**游戏配置**是屡见不鲜的东西了。一个好的配置生成工具能让你在开发中事半功倍。

通常来说，**配置**都是由**策划**来产出并维护的，绝大多数**策划岗**都不了解开发，他们最喜欢的就是**Excel表格**（**Excel**的确是个好东西）。

本工具的主要功能就是把**Excel表格**导出成程序可用的数据。

---

## 一、安装依赖

1. 安装 [Node.js LTS版](https://nodejs.org/en/)（写本工具时用的版本是*16.17.0*）。
2. 打开`命令行`，将目录定位到 `Generator` 目录。
3. 在命令行中执行命令： npm i。

---

## 三、使用说明

1. 所有配置表的格式为 `*.xls` 或 `*.xlsx`。
2. 所有配置表都放在本文件夹之下（可嵌套文件夹）。
   其实也可以放在其它地方，通过修改 **Generator/Config.json 的 excel_url** 可以设置配置表路径。
3. 双击 **gen.bat** 可生成所有配置。

### 3.1 Excel 前置表行说明

**第1行**

1. **第一格**为配置表名称。
2. **第二格**为配置表格式（**横表(Horizontal)、纵表(Vertical)或枚举表(Enum)**），**填英文**。
3. **第三格**，如果是**枚举表**则为是**生成至..**，如果是**横表**则为**父表名称**。

**第2行**

字段 + 字段类型。

格式：用`#`隔开。

> 例：**name#string**。

**第3行**

字段特殊类型。

目前有**数组、表连接、枚举**，下面会详述。

**第4行**

主键。

第一主键填1，第二主键填2...，以此类推。

**第5行**

生成至...。

根据**Generator/Config.json**的**exports**的**id**去填写。

格式：用`|`隔开，

> 例：**1|2|3**。（**若不填写则全部都生成**）

**第6行**

默认值。

**第7行**

说明备注。

### 3.2 字段与类型

字段和类型是填写在同一个单元格的，**不能包含中文和空格，首个字符不能是数字**，例如：`sub_type#int`或`subType#int`，生成给程序的都是**小驼峰命名方式**——`subType: number`，如下图：

![array](https://github.com/gh-kL/GameConfig/blob/main/Config/Generator/img/field_name.png?raw=true)

类型支持：

| 类型             | 关键字       | 语言支持 |
| :--------------- | :----------- | :------: |
| 布尔             | bool         |   全部   |
| 整型             | int          |   全部   |
| 浮点型           | float        |   全部   |
| 字符串           | string       |   全部   |
| 布尔一维数组     | bool[]       |   全部   |
| 布尔二维数组     | bool[][]     |   全部   |
| 布尔三维数组     | bool[][][]   |   全部   |
| 整型一维数组     | int[]        |   全部   |
| 整型二维数组     | int[][]      |   全部   |
| 整型三维数组     | int[][][]    |   全部   |
| 浮点型一维数组   | float[]      |   全部   |
| 浮点型二维数组   | float[][]    |   全部   |
| 浮点型三维数组   | float[][][]  |   全部   |
| 字符串一维数组   | string[]     |   全部   |
| 字符串二维数组   | string[][]   |   全部   |
| 字符串三维数组   | string[][][] |   全部   |
| 任意类型         | any          |  JS/TS   |
| 任意类型一维数组 | any[]        |  JS/TS   |

### 3.3 生成至..

顾名思义，就是生成至哪个端，填写方式由 `|` 隔开，如下图：

![array](https://github.com/gh-kL/GameConfig/blob/main/Config/Generator/img/gen_to.png?raw=true)

比如现在的 **Config.json** 文件中是这样的：

| ID   | 端                     |
| :--- | :--------------------- |
| 1    | Unity 示例项目         |
| 2    | Cocos Creator 示例项目 |

### 3.4 特殊类型

#### 3.4.1 数组

在特殊类型的单元格填`array#字段名`即可。如下图：

![array](https://github.com/gh-kL/GameConfig/blob/main/Config/Generator/img/array.png?raw=true)

导出到程序端是这样子：

```json
"attr": [
    [ 10001, 50 ],
    [ 10002, 60 ],
    [ 10003, 30 ],
    [ 10004, 30 ],
    [ 10005, 20 ],
]
```

#### 3.4.2 表连接

在特殊类型的单元格填`link#配置表名`即可。如下图：

![link](https://github.com/gh-kL/GameConfig/blob/main/Config/Generator/img/link.png?raw=true)

上图表示的是 langId 字段连接了语言表（Lang），所以请**确保有另一张叫做 Lang 的表存在**！

设置了**表连接**后，程序员就可以很方便的访问到 Lang 配置，伪代码：

```js
this.btn.text = config.langId.cn;
```

> 表连接对于策划来说没有任何感知，只是生成出来的配置程序员会用得更舒服。

#### 3.4.3 枚举

在特殊类型的单元格填`enum#枚举表名`即可。如下图：

![link](https://github.com/gh-kL/GameConfig/blob/main/Config/Generator/img/enum.png?raw=true)

上图表示的是`type`为枚举类型（asset_type）的**枚举**，所以请**确保有另一张叫做 AssetType 的枚举表存在**！

> 其实填`enum#AssetType`也可以，没差别。

枚举表的格式比较特殊，如下图：

![link](https://github.com/gh-kL/GameConfig/blob/main/Config/Generator/img/enum_sheet.png?raw=true)

> 第一列为 **枚举Key**。
> 第二列为 **枚举Value**。**（JS、TS支持整型与字符串；C#端仅支持整型）**
> 第二列为 **备注说明**。

---

## 四、配置（Config）

本工具的配置在是`Generator/Config.json`。

字段说明：

```json
{
    excel_url: "配置表URL（Excel的文件夹路径）",
    export_suffix: "配置导出脚本后的命名后缀（推荐Config）",
    export_item_suffix: "配置子项导出脚本后的命名后缀（推荐Item）",
    export_collection_suffix: "多主键配置导出脚本后字典的命名后缀（推荐Map）",
    export_data_splitor_random_enabled: "导出的配置脚本是否生成随机分隔符",
    export_data_splitor: "固定分隔符",
    origin_export_url: "源配置文件夹路径",
    origin_json_url: "源配置 JSON 的路径",
    origin_remark_url: "源配置 Remark JSON 的路径",
    origin_enum_url: "源配置 Enum JSON 的路径",
    exports: [  // 所有导出项
        id: "导出项 ID",
        enabled: "启用（控制是否生成配置）",
        code_language: "代码语言",
        script_suffix: "脚本文件后缀（扩展名）",
        force_make_dir: "强制创建路径",
        export_url: "配置文件导出路径",
        export_script_url: "配置脚本导出路径",
        export_config_manager_name: "配置管理器脚本名称",
    ],
}
```

> Config 中，`id`为`0`的导出项是固定的，用于生成JSON源数据，一般情况下禁止更改。

## 五、自定义导出项（程序向）

### 5.1 项目结构

| 文件夹       | 描述                                                   |
| :----------- | :----------------------------------------------------- |
| dist         | 编译脚本导出路径                                       |
| img          | 图片（主要作用于本 Markdown）                          |
| node_modules | node 模块目录（第一章的**安装依赖**就是安装到这里）    |
| src          | 源码                                                   |
| templates    | 模板，用于生成代码的模板文本文件                       |
| Config.json  | 本工具的配置文件                                       |
| 其它文件     | 其它就不解释了，想要了解请自行百度`TypeScript项目结构` |

### 5.2 自定义生成配置脚本

目前工具内已内置了生成**TS、C#**配置脚本的源码，分别是`GenTSModule.ts`和`GenCSModule.ts`。

比如你想要生成**Lua**配置脚本，那就新建个`GenLuaModule.ts`，逻辑呢就参考上面的两个就好，写起来会比较枯燥。

言尽于此。

---

Author: kL

E-mail: *klk0@qq.com*

---
