namespace webapi.Contracts
{
    public interface IExternalService
    {
        public Task<object> GetBasicInfo(string RRN);
    }
}
