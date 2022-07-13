namespace webapi.Interfaces
{
    public interface IExternalService
    {
        public Task<object> GetBasicInfo(string RRN);
    }
}
