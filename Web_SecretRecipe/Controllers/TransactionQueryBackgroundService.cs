using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class TransactionQueryBackgroundService : BackgroundService
{
    private readonly ILogger<TransactionQueryBackgroundService> _logger;
    private readonly IServiceProvider _serviceProvider;

    public TransactionQueryBackgroundService(ILogger<TransactionQueryBackgroundService> logger, IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await PerformQueryIfNoCallback();
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken); // 1 TPS limit
        }
    }

    private async Task PerformQueryIfNoCallback()
    {
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "Logs", "Payment", "pending_transactions.json");

        if (!File.Exists(filePath))
            return;

        var json = await File.ReadAllTextAsync(filePath);
        var pendingTransactions = JsonSerializer.Deserialize<List<PendingTransaction>>(json) ?? new();

        foreach (var txn in pendingTransactions
            .Where(t => !t.IsCallbackReceived && !t.IsQueried && DateTime.UtcNow - t.CreatedAt > TimeSpan.FromMinutes(5)))
        {
            try
            {
                _logger.LogInformation($"[BackgroundJob] Querying ENets for txnRef: {txn.MerchantTxnRef}");

                // Your API call here:
                var result = await QueryTransactionFromEnets(txn.MerchantTxnRef);

                txn.IsQueried = true;
                txn.QueryResult = result;

                await File.WriteAllTextAsync(filePath, JsonSerializer.Serialize(pendingTransactions));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error querying ENets for txn: {Txn}", txn.MerchantTxnRef);
            }

            await Task.Delay(1000); // Enforce 1 TPS
        }
    }

    private async Task<string> QueryTransactionFromEnets(string txnRef)
    {
        var payload = new
        {
            ss = "1",
            msg = new
            {
                merchantTxnRef = txnRef
            }
        };

        var client = new HttpClient();
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await client.PostAsync("https://enets-query-endpoint", content);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }
}

public class PendingTransaction
{
    public string MerchantTxnRef { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsCallbackReceived { get; set; }
    public bool IsQueried { get; set; }
    public string QueryResult { get; set; }
}
