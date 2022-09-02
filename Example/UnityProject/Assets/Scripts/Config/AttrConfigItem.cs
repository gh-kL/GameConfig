using System.Collections.Generic;

namespace GameConfig
{
    public class AttrConfigItem
    {
        /// <summary>
        /// 唯一主键
        /// </summary>
        public int UniqueKey { private set; get; }
        /// <summary>
        /// 索引（id）
        /// </summary>
        public int Id { private set; get; }
        /// <summary>
        /// 字段
        /// </summary>
        public string Field { private set; get; }
        /// <summary>
        /// 名称
        /// </summary>
        public string Name { private set; get; }

        public AttrConfigItem(int uniqueKey, int id, string field, string name)
        {
            UniqueKey = uniqueKey;
            Id = id;
            Field = field;
            Name = name;
        }
    }
}