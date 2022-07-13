using Microsoft.AspNetCore.Mvc;
using webapi.Interfaces;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace webapi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExternalServiceController : ControllerBase
    {
        private IExternalService _externalService;
        public ExternalServiceController(IExternalService externalService) 
        {
            _externalService = externalService;
        }

        // GET: api/<ExternalServiceController>
        [HttpGet]
        public IEnumerable<string> Get()
        {
            return new string[] { "value1", "value2" };
        }

        // GET api/<ExternalServiceController>/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Object>> Get(string id)
        {
            return await _externalService.GetBasicInfo(id);
        }

        // POST api/<ExternalServiceController>
        [HttpPost]
        public void Post([FromBody] string value)
        {
        }

        // PUT api/<ExternalServiceController>/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody] string value)
        {
        }

        // DELETE api/<ExternalServiceController>/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }
    }
}
