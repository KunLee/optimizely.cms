using repos.Contracts;

namespace repos.Services
{
    public class LookupService : ILookupService
    {
        private readonly IContentRepository _contentRepository;

        public LookupService(IContentRepository contentRepository) 
        {
            _contentRepository = contentRepository;
        }

        public object GetSearchResult(string type, string content)
        {
            throw new NotImplementedException();
        }
    }
}
