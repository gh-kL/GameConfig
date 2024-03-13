export interface RemarkField {
    /**
     * 类型
     */
    type?: string;
    /**
     * “生成至”数组
     */
    generate?: number[];
    /**
     * 注释
     */
    annotation?: string;
    /**
     * 枚举
     */
    enum?: string;
    /**
     * 链接
     */
    link?: string;
    /**
     * 链接为数组
     */
    linkIsArray?: boolean;
}