import { CodeLang } from "./CodeLang";

/**
 * @Doc 配置导出
 * @Author kL
 * @Date 2020/7/18 11:18
 */
export interface IConfigExport {
  /**
   * 导出项 ID
   */
  id: number;
  /**
   * 模板的名字
   */
  template_name: string;
  /**
   * 启用（控制是否生成配置）
   */
  enabled: boolean;
  /**
   * 代码语言
   */
  code_language: CodeLang;
  /**
   * 脚本文件后缀（扩展名）
   */
  script_suffix: string;
  /**
   * 强制创建路径
   */
  force_make_dir: boolean;
  /**
   * 配置文件导出路径
   */
  export_url: string;
  /**
   * 配置脚本导出路径
   */
  export_script_url: string;
  /**
   * 配置组件导出路径
   */
  export_com_url: string;
  /**
   * 配置源文件导出路径
   */
  origin_export_url: string;
  /**
   * 导出的配置管理器名称
   */
  export_config_manager_name: string;
  /**
   * 导出的配置组件名称
   */
  export_config_com_name: string;
}