using System;
using System.Collections.Generic;
using System.Text;

namespace GameConfig
{
    public class ConfigUtility
    {
        public static string EncodeBase64(string source)
        {
            return EncodeBase64(Encoding.UTF8, source);
        }

        public static string EncodeBase64(Encoding encoding, string source)
        {
            string encode;
            byte[] bytes = encoding.GetBytes(source);
            try
            {
                encode = Convert.ToBase64String(bytes);
            }
            catch (Exception e)
            {
                encode = source;
            }

            return encode;
        }

        public static string DecodeBase64(string result)
        {
            return DecodeBase64(Encoding.UTF8, result);
        }

        public static string DecodeBase64(Encoding encoding, string result)
        {
            string decode;
            byte[] bytes = Convert.FromBase64String(result);
            try
            {
                decode = encoding.GetString(bytes);
            }
            catch (Exception e)
            {
                decode = result;
            }

            return decode;
        }

        /// <summary>
        /// 解析 Bool
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static bool ParseBool(string str)
        {
            if (string.IsNullOrEmpty(str))
                return default;
            return bool.Parse(str);
        }

        /// <summary>
        /// 解析 Int
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static int ParseInt(string str)
        {
            if (string.IsNullOrEmpty(str))
                return default;
            return int.Parse(str);
        }

        /// <summary>
        /// 解析 float
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static float ParseFloat(string str)
        {
            if (string.IsNullOrEmpty(str))
                return default;
            return float.Parse(str);
        }

        /// <summary>
        /// 解析 Int 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<int> ParseIntList(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<int> result = new List<int>();

            StringBuilder stringBuilder = new StringBuilder();

            int strLength = str.Length;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('['))
                {
                }
                else if (ch.Equals(']'))
                {
                    result.Add(int.Parse(stringBuilder.ToString()));
                }
                else if (ch.Equals(','))
                {
                    result.Add(int.Parse(stringBuilder.ToString()));
                    stringBuilder = new StringBuilder();
                }
                else
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析 Float 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<float> ParseFloatList(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<float> result = new List<float>();

            StringBuilder stringBuilder = new StringBuilder();

            int strLength = str.Length;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('['))
                {
                }
                else if (ch.Equals(']'))
                {
                    result.Add(float.Parse(stringBuilder.ToString()));
                }
                else if (ch.Equals(','))
                {
                    result.Add(float.Parse(stringBuilder.ToString()));
                    stringBuilder = new StringBuilder();
                }
                else
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析 String 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<string> ParseStringList(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<string> result = new List<string>();

            StringBuilder stringBuilder = new StringBuilder();

            int strLength = str.Length;

            int quoteCount = 0;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('"'))
                {
                    quoteCount++;
                }

                if (quoteCount % 2 == 0)
                {
                    if (ch.Equals('['))
                    {
                    }
                    else if (ch.Equals(']'))
                    {
                        if (quoteCount > 0)
                        {
                            var addStr = stringBuilder.ToString();
                            result.Add(addStr);
                        }

                        quoteCount = 0;
                    }
                    else if (ch.Equals(','))
                    {
                        if (quoteCount > 0)
                        {
                            var addStr = stringBuilder.ToString();
                            result.Add(addStr);
                        }

                        stringBuilder = new StringBuilder();
                        quoteCount = 0;
                    }
                }
                else if (!ch.Equals('"'))
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析二维 Int 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<List<int>> ParseIntList2(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<List<int>> result = new List<List<int>>();

            List<int> layer2Param = null;

            StringBuilder stringBuilder = new StringBuilder();

            int layer = 0;

            int strLength = str.Length;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('['))
                {
                    layer++;
                    if (layer == 2)
                    {
                        layer2Param = new List<int>();
                    }
                }
                else if (ch.Equals(']'))
                {
                    layer--;
                    if (layer == 1)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer2Param == null)
                                layer2Param = new List<int>();
                            layer2Param.Add(int.Parse(addStr));
                        }

                        result.Add(layer2Param);
                        layer2Param = null;
                        stringBuilder = new StringBuilder();
                    }
                }
                else if (ch.Equals(','))
                {
                    if (layer == 2)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer2Param == null)
                                layer2Param = new List<int>();
                            layer2Param.Add(int.Parse(addStr));
                        }

                        stringBuilder = new StringBuilder();
                    }
                }
                else
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析二维 Float 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<List<float>> ParseFloatList2(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<List<float>> result = new List<List<float>>();

            List<float> layer2Param = null;

            StringBuilder stringBuilder = new StringBuilder();

            int layer = 0;

            int strLength = str.Length;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('['))
                {
                    layer++;
                    if (layer == 2)
                    {
                        layer2Param = new List<float>();
                    }
                }
                else if (ch.Equals(']'))
                {
                    layer--;
                    if (layer == 1)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer2Param == null)
                                layer2Param = new List<float>();
                            layer2Param.Add(float.Parse(addStr));
                        }

                        result.Add(layer2Param);
                        layer2Param = null;
                        stringBuilder = new StringBuilder();
                    }
                }
                else if (ch.Equals(','))
                {
                    if (layer == 2)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer2Param == null)
                                layer2Param = new List<float>();
                            layer2Param.Add(float.Parse(addStr));
                        }

                        stringBuilder = new StringBuilder();
                    }
                }
                else
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析二维 String 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<List<string>> ParseStringList2(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<List<string>> result = new List<List<string>>();

            List<string> layer2Param = null;

            StringBuilder stringBuilder = new StringBuilder();

            int layer = 0;

            int strLength = str.Length;

            int quoteCount = 0;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('"'))
                {
                    quoteCount++;
                }

                if (quoteCount % 2 == 0)
                {
                    if (ch.Equals('['))
                    {
                        layer++;
                        if (layer == 2)
                        {
                            layer2Param = new List<string>();
                        }
                    }
                    else if (ch.Equals(']'))
                    {
                        layer--;
                        if (layer == 1)
                        {
                            if (quoteCount > 0)
                            {
                                var addStr = stringBuilder.ToString();
                                if (layer2Param == null)
                                    layer2Param = new List<string>();
                                layer2Param.Add(addStr);
                            }

                            result.Add(layer2Param);
                            layer2Param = null;
                            stringBuilder = new StringBuilder();
                            quoteCount = 0;
                        }
                    }
                    else if (ch.Equals(','))
                    {
                        if (layer == 2)
                        {
                            if (quoteCount > 0)
                            {
                                var addStr = stringBuilder.ToString();
                                if (layer2Param == null)
                                    layer2Param = new List<string>();
                                layer2Param.Add(addStr);
                            }

                            stringBuilder = new StringBuilder();
                            quoteCount = 0;
                        }
                    }
                }
                else if (!ch.Equals('"'))
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析三维 Int 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<List<List<int>>> ParseIntList3(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<List<List<int>>> result = new List<List<List<int>>>();

            List<List<int>> layer2Param = null;

            List<int> layer3Param = null;

            StringBuilder stringBuilder = new StringBuilder();

            int layer = 0;

            int strLength = str.Length;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('['))
                {
                    layer++;
                    if (layer == 2)
                    {
                        layer2Param = new List<List<int>>();
                    }
                    else if (layer == 3)
                    {
                        layer3Param = new List<int>();
                    }
                }
                else if (ch.Equals(']'))
                {
                    layer--;
                    if (layer == 1)
                    {
                        result.Add(layer2Param);
                        layer2Param = null;
                        stringBuilder = new StringBuilder();
                    }
                    else if (layer == 2)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer3Param == null)
                                layer3Param = new List<int>();
                            layer3Param.Add(int.Parse(addStr));
                        }

                        layer2Param.Add(layer3Param);
                        layer3Param = null;
                        stringBuilder = new StringBuilder();
                    }
                }
                else if (ch.Equals(','))
                {
                    if (layer == 3)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer3Param == null)
                                layer3Param = new List<int>();
                            layer3Param.Add(int.Parse(addStr));
                        }

                        stringBuilder = new StringBuilder();
                    }
                }
                else
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析三维 Float 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<List<List<float>>> ParseFloatList3(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<List<List<float>>> result = new List<List<List<float>>>();

            List<List<float>> layer2Param = null;

            List<float> layer3Param = null;

            StringBuilder stringBuilder = new StringBuilder();

            int layer = 0;

            int strLength = str.Length;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('['))
                {
                    layer++;
                    if (layer == 2)
                    {
                        layer2Param = new List<List<float>>();
                    }
                    else if (layer == 3)
                    {
                        layer3Param = new List<float>();
                    }
                }
                else if (ch.Equals(']'))
                {
                    layer--;
                    if (layer == 1)
                    {
                        result.Add(layer2Param);
                        layer2Param = null;
                        stringBuilder = new StringBuilder();
                    }
                    else if (layer == 2)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer3Param == null)
                                layer3Param = new List<float>();
                            layer3Param.Add(float.Parse(addStr));
                        }

                        layer2Param.Add(layer3Param);
                        layer3Param = null;
                        stringBuilder = new StringBuilder();
                    }
                }
                else if (ch.Equals(','))
                {
                    if (layer == 3)
                    {
                        var addStr = stringBuilder.ToString();
                        if (!string.IsNullOrEmpty(addStr))
                        {
                            if (layer3Param == null)
                                layer3Param = new List<float>();
                            layer3Param.Add(float.Parse(addStr));
                        }

                        stringBuilder = new StringBuilder();
                    }
                }
                else
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 解析三维 String 列表
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static List<List<List<string>>> ParseStringList3(string str)
        {
            if (string.IsNullOrEmpty(str))
                return null;

            List<List<List<string>>> result = new List<List<List<string>>>();

            List<List<string>> layer2Param = null;

            List<string> layer3Param = null;

            StringBuilder stringBuilder = new StringBuilder();

            int layer = 0;

            int strLength = str.Length;

            int quoteCount = 0;

            for (int n = 0; n < strLength; n++)
            {
                char ch = str[n];

                if (ch.Equals('"'))
                {
                    quoteCount++;
                }

                if (quoteCount % 2 == 0)
                {
                    if (ch.Equals('['))
                    {
                        layer++;
                        if (layer == 2)
                        {
                            layer2Param = new List<List<string>>();
                        }
                        else if (layer == 3)
                        {
                            layer3Param = new List<string>();
                        }
                    }
                    else if (ch.Equals(']'))
                    {
                        layer--;
                        if (layer == 1)
                        {
                            result.Add(layer2Param);
                            layer2Param = null;
                            stringBuilder = new StringBuilder();
                        }
                        else if (layer == 2)
                        {
                            if (quoteCount > 0)
                            {
                                var addStr = stringBuilder.ToString();
                                if (layer3Param == null)
                                    layer3Param = new List<string>();
                                layer3Param.Add(addStr);
                            }

                            layer2Param.Add(layer3Param);
                            layer3Param = null;
                            stringBuilder = new StringBuilder();
                            quoteCount = 0;
                        }
                    }
                    else if (ch.Equals(','))
                    {
                        if (layer == 3)
                        {
                            var addStr = stringBuilder.ToString();
                            if (layer3Param == null)
                                layer3Param = new List<string>();
                            layer3Param.Add(addStr);

                            stringBuilder = new StringBuilder();
                            quoteCount = 0;
                        }
                    }
                }
                else if (!ch.Equals('"'))
                {
                    stringBuilder.Append(ch);
                }
            }

            return result;
        }

        /// <summary>
        /// 获取被连接的配置
        /// </summary>
        /// <param name="keys"></param>
        /// <param name="config"></param>
        /// <typeparam name="T"></typeparam>
        /// <typeparam name="W"></typeparam>
        /// <returns></returns>
        public static IReadOnlyList<W> GetLinkedConfigs<T, W>(List<T> keys, BaseConfig<T, W> config)
        {
            var result = new List<W>(keys.Count);
            for (var i = 0; i < keys.Count; i++)
            {
                result.Add(config.Get(keys[i], true));
            }

            return result.AsReadOnly();
        }
    }
}