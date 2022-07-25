using EPiServer.Framework;
using EPiServer.Framework.Initialization;
using EPiServer.ServiceLocation;
using repos.Contracts;
using repos.Services;

namespace repos.Initialization
{
    [ModuleDependency(typeof(ServiceContainerInitialization))]
    public class DependencyInjection : IConfigurableModule
    {
        public void ConfigureContainer(ServiceConfigurationContext context)
        {
            //context.Services.AddTransient<ILookupService, LookupService>();
            context.Services.AddSingleton<ILookupService, LookupService>();
            //context.Services.AddTransient<IExternalOutputService, ExternalOutputService>();
        }

        public void Initialize(InitializationEngine context)
        {
            //throw new NotImplementedException();
        }

        public void Uninitialize(InitializationEngine context)
        {
            //throw new NotImplementedException();
        }
    }
}
