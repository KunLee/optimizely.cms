namespace repos.Contracts
{
    public interface IExternalOutputService
    {
        public Task<object> SendOutput(object data, string uri, string param1 = "", string param2 = "");
    }
}
