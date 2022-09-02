using System;
using System.Collections.Generic;

namespace GameConfig
{
    public class BaseConfig<T, W>
    {
        public string ConfigName { get; private set; }

        public IReadOnlyDictionary<T, W> Data { private set; get; }

        public BaseConfig(string configName, IReadOnlyDictionary<T, W> data)
        {
            ConfigName = configName;
            Data = data;
        }

        public W Get(T key)
        {
            Data.TryGetValue(key, out var result);
            return result;
        }

        public W Get(T key, bool ifNullThrowException)
        {
            if (ifNullThrowException)
            {
                if (!Data.ContainsKey(key))
                    throw new Exception($"{ConfigName} not found => {key}");
            }

            Data.TryGetValue(key, out var result);
            return result;
        }
    }
}