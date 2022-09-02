export class BaseConfig<T, W> {
    private _configName: string;
    public get configName() {
        return this._configName;
    }

    private _data: Map<T, W>;
    public get data(): Map<T, W> {
        return this._data;
    };

    constructor(configName: string, sourceData: Map<T, W>) {
        this._configName = configName;
        this._data = sourceData;
    }

    public get(key: T, ifNullThrowError: boolean = false): W {
        if (ifNullThrowError) {
            if (!this._data.has(key))
                console.error(`${this._configName} not found => ${key}`);
        }
        return this._data.get(key);
    }
}