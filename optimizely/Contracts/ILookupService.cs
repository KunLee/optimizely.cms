namespace repos.Contracts
{
    public interface ILookupService
    {
        public object GetSearchResult(string type, string content);
    }
}
