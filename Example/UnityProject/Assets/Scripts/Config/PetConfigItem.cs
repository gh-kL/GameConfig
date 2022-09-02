using System.Collections.Generic;

namespace GameConfig
{
    public class PetConfigItem
    {
        /// <summary>
        /// 唯一主键
        /// </summary>
        public int UniqueKey { private set; get; }
        /// <summary>
        /// ID（索引）
        /// </summary>
        public int Id { private set; get; }
        /// <summary>
        /// 类型
        /// </summary>
        public PetType Type { private set; get; }
        /// <summary>
        /// 名称
        /// </summary>
        public string Name { private set; get; }
        /// <summary>
        /// 技能
        /// </summary>
        public IReadOnlyList<int> Skills { private set; get; }

        public PetConfigItem(int uniqueKey, int id, PetType type, string name, IReadOnlyList<int> skills)
        {
            UniqueKey = uniqueKey;
            Id = id;
            Type = type;
            Name = name;
            Skills = skills;
        }
    }
}