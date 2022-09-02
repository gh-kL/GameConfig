using System.Collections.Generic;

namespace GameConfig
{
    public class KVConfig
    {
        public string ConfigName { get; private set; }
        public string GameName { private set; get; }
        public string Version { private set; get; }
        public IReadOnlyList<int> A { private set; get; }
        public IReadOnlyList<IReadOnlyList<int>> B { private set; get; }
        public IReadOnlyList<string> C { private set; get; }
        public int D { private set; get; }
        public bool F { private set; get; }

        public KVConfig(string configName, string gameName, string version, IReadOnlyList<int> a, IReadOnlyList<IReadOnlyList<int>> b, IReadOnlyList<string> c, int d, bool f)
        {
            ConfigName = configName;
            GameName = gameName;
            Version = version;
            A = a;
            B = b;
            C = c;
            D = d;
            F = f;
        }
    }
}