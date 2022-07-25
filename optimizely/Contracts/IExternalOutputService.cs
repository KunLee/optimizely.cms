namespace repos.Contracts
{
    public interface IExternalOutputService
    {
        public Task<object> SendOutput(object data, string baseAddress, string uri, string token = "", string param1 = "", string param2 = "");
    }
}
