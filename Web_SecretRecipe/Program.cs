using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Web_SecretRecipe.Models;
using System.Net;
using Polly;
using Polly.Extensions.Http;
using System;

namespace Web_SecretRecipe
{
    public class Program
    {
        public static void Main(string[] args)
        {
            // Force TLS 1.2 for secure connections
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

            var builder = WebApplication.CreateBuilder(args);

            // Configuration Bindings
            builder.Services.Configure<ApiSettings>(builder.Configuration.GetSection("ApiSettings"));
            builder.Services.Configure<CasdoorSettings>(builder.Configuration.GetSection("Casdoor"));

            // Register HTTP clients with Polly resilience
            builder.Services.AddHttpClient("PaymentClient", client =>
            {
                client.BaseAddress = new Uri(builder.Configuration["eNETS:BaseUrl"]);
                client.DefaultRequestHeaders.Add("Accept", "application/json");
            })
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

            builder.Services.AddHttpClient(); // Generic client

            // MVC and API Controllers
            builder.Services.AddControllers().AddXmlSerializerFormatters();
            builder.Services.AddControllersWithViews()
                .AddSessionStateTempDataProvider();

            // Background Services
            builder.Services.AddHostedService<TransactionQueryBackgroundService>();

            // Session
            builder.Services.AddDistributedMemoryCache();
            builder.Services.AddSession(options =>
            {
                options.IdleTimeout = TimeSpan.FromDays(30);
                options.Cookie.HttpOnly = true;
                options.Cookie.IsEssential = true;
            });
            builder.Services.AddMemoryCache();


            // Authentication
            builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie(options =>
                {
                    options.LoginPath = "/SecretRecipe/Login";
                    options.Cookie.HttpOnly = true;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                    options.ExpireTimeSpan = TimeSpan.FromDays(1);
                    options.SlidingExpiration = true;
                });

            builder.Services.AddHttpClient("OpenbravoClient", client => {
                // Set global things here if they never change
                client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0");
            }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                UseCookies = true,
                CookieContainer = new CookieContainer() // This maintains the session across requests
            });

            // Kestrel limits
            builder.WebHost.ConfigureKestrel(options =>
            {
                options.Limits.MaxRequestHeadersTotalSize = 52428800;
                options.Limits.MaxRequestLineSize = 52428800;
                options.Limits.MaxRequestBodySize = 52428800;
            });

            // IIS limits
            builder.Services.Configure<IISServerOptions>(options =>
            {
                options.MaxRequestBodySize = 52428800;
            });

            // CORS
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                });
            });

            builder.Services.AddEndpointsApiExplorer();

            var app = builder.Build();

            // Global exception handler (Always use production-safe handler)
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();

            // Middleware order matters
            app.UseHttpsRedirection();
            app.UseStaticFiles();

            app.UseSession();


            app.UseRouting();

            app.UseCors("AllowAll");

            app.UseAuthentication();
            app.UseAuthorization();


            // Routes
            app.MapControllerRoute(
                name: "default",
                pattern: "{controller=SecretRecipe}/{action=Home}/{id?}"
            );

            app.Run();
        }

        // Polly: Retry Policy
        static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
        {
            return HttpPolicyExtensions
                .HandleTransientHttpError()
                .Or<TimeoutException>()
                .WaitAndRetryAsync(
                    retryCount: 3,
                    sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    onRetry: (exception, delay, retryCount, context) =>
                    {
                        Console.WriteLine($"Retry {retryCount} after {delay.TotalSeconds}s due to: {exception.Exception?.Message ?? exception.Result?.StatusCode.ToString()}");
                    });
        }

        // Polly: Circuit Breaker Policy
        static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
        {
            return HttpPolicyExtensions
                .HandleTransientHttpError()
                .Or<TimeoutException>()
                .CircuitBreakerAsync(
                    handledEventsAllowedBeforeBreaking: 3,
                    durationOfBreak: TimeSpan.FromSeconds(30),
                    onBreak: (exception, breakDelay) =>
                    {
                        Console.WriteLine($"Circuit broken for {breakDelay.TotalSeconds}s");
                    },
                    onReset: () =>
                    {
                        Console.WriteLine("Circuit reset");
                    },
                    onHalfOpen: () =>
                    {
                        Console.WriteLine("Circuit half-open (testing connection)");
                    });
        }
    }
}
