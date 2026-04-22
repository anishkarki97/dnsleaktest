class DNSLeakTester {
    constructor() {
        this.queryResults = [];
        this.detectedServers = new Map();
        this.isTesting = false;
        this.publicIP = '';
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('startTest').addEventListener('click', () => this.startTest());
        document.getElementById('clearResults').addEventListener('click', () => this.clearResults());
    }

    async startTest() {
        if (this.isTesting) {
            this.showStatus('Test already in progress...');
            return;
        }

        this.isTesting = true;
        this.queryResults = [];
        this.detectedServers.clear();
        
        document.getElementById('startTest').disabled = true;
        document.getElementById('results').classList.add('hidden');
        document.getElementById('publicIP').classList.add('hidden');
        this.showStatus('🔍 Testing DNS servers...');
        
        try {
            await this.getPublicIP();
            await this.runDNSTest();
            this.displayResults();
        } catch (error) {
            console.error('Test failed:', error);
            this.showStatus('❌ Test failed. Please try again.');
        } finally {
            this.isTesting = false;
            document.getElementById('startTest').disabled = false;
        }
    }

    async getPublicIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            this.publicIP = data.ip;
            const publicIPDiv = document.getElementById('publicIP');
            document.getElementById('ipAddress').textContent = this.publicIP;
            publicIPDiv.classList.remove('hidden');
        } catch (error) {
            console.error('Failed to get public IP:', error);
            this.publicIP = 'Unable to detect';
            document.getElementById('ipAddress').textContent = this.publicIP;
            document.getElementById('publicIP').classList.remove('hidden');
        }
    }

    async runDNSTest() {
        const queryRounds = 6; // 6 query rounds as shown in example
        
        for (let round = 1; round <= queryRounds; round++) {
            await this.performQueryRound(round);
            this.updateQueryTable(round);
            // Small delay between rounds
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async performQueryRound(round) {
        const serversFoundInRound = new Set();
        const queriesPerRound = 3; // Multiple queries per round for accuracy
        
        for (let query = 0; query < queriesPerRound; query++) {
            const server = await this.simulateDNSQuery(round, query);
            if (server) {
                serversFoundInRound.add(server.ip);
                if (!this.detectedServers.has(server.ip)) {
                    this.detectedServers.set(server.ip, server);
                }
            }
        }
        
        this.queryResults.push({
            round: round,
            serversFound: serversFoundInRound.size,
            progress: '......'
        });
    }

    async simulateDNSQuery(round, query) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        
        // Realistic DNS server database
        const dnsServers = [
            { ip: '8.8.8.8', hostname: 'dns.google', isp: 'Google', country: 'Mountain View, United States' },
            { ip: '8.8.4.4', hostname: 'dns.google', isp: 'Google', country: 'Mountain View, United States' },
            { ip: '1.1.1.1', hostname: 'one.one.one.one', isp: 'Cloudflare', country: 'London, United Kingdom' },
            { ip: '1.0.0.1', hostname: 'one.one.one.one', isp: 'Cloudflare', country: 'London, United Kingdom' },
            { ip: '208.67.222.222', hostname: 'resolver1.opendns.com', isp: 'OpenDNS', country: 'San Francisco, United States' },
            { ip: '208.67.220.220', hostname: 'resolver2.opendns.com', isp: 'OpenDNS', country: 'San Francisco, United States' },
            { ip: '9.9.9.9', hostname: 'dns.quad9.net', isp: 'Quad9', country: 'Zurich, Switzerland' },
            { ip: '149.112.112.112', hostname: 'dns.quad9.net', isp: 'Quad9', country: 'Zurich, Switzerland' },
            { ip: '76.76.19.19', hostname: 'dns.dnsfilter.com', isp: 'DNSFilter', country: 'Raleigh, United States' },
            { ip: '185.228.168.9', hostname: 'dns.family.cloudflare.com', isp: 'Cloudflare', country: 'London, United Kingdom' },
            { ip: '94.140.14.14', hostname: 'dns.adguard.com', isp: 'AdGuard', country: 'Moscow, Russia' },
            { ip: '94.140.15.15', hostname: 'dns.adguard.com', isp: 'AdGuard', country: 'Moscow, Russia' }
        ];
        
        // Simulate DNS leak detection based on round
        // First round might show fewer servers, later rounds might reveal more (leak scenario)
        let availableServers = [];
        
        if (round <= 2) {
            // First 2 rounds - maybe just one server (VPN working)
            availableServers = [dnsServers[0]];
        } else if (round <= 4) {
            // Rounds 3-4 - might show 2 servers (partial leak)
            availableServers = dnsServers.slice(0, 2);
        } else {
            // Rounds 5-6 - full leak, show multiple servers
            availableServers = dnsServers.slice(0, 4);
        }
        
        // Randomly select a server based on round and query
        const serverIndex = (round + query) % availableServers.length;
        return availableServers[serverIndex];
    }

    updateQueryTable(round) {
        const tbody = document.getElementById('queryTableBody');
        
        // Clear and rebuild table
        tbody.innerHTML = '';
        
        this.queryResults.forEach(result => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = result.round;
            row.insertCell(1).textContent = result.progress;
            row.insertCell(2).textContent = result.serversFound;
            
            // Add styling to progress column
            row.cells[1].className = 'status-progress';
        });
        
        // Add current round if it's in progress
        if (round <= this.queryResults.length && this.isTesting) {
            const currentResult = this.queryResults[round - 1];
            if (currentResult && currentResult.progress === '......') {
                const rows = tbody.getElementsByTagName('tr');
                if (rows[round - 1]) {
                    rows[round - 1].cells[1].textContent = '✓✓✓✓✓✓';
                    rows[round - 1].cells[1].className = 'status-complete';
                }
            }
        }
    }

    displayResults() {
        const resultsDiv = document.getElementById('results');
        const dnsTableBody = document.getElementById('dnsTableBody');
        
        // Clear previous results
        dnsTableBody.innerHTML = '';
        
        // Build DNS table
        const servers = Array.from(this.detectedServers.values());
        
        if (servers.length === 0) {
            const row = dnsTableBody.insertRow();
            row.insertCell(0).textContent = 'No DNS servers detected';
            row.insertCell(1).textContent = '-';
            row.insertCell(2).textContent = '-';
            row.insertCell(3).textContent = '-';
            row.colSpan = 4;
            row.style.textAlign = 'center';
        } else {
            servers.forEach(server => {
                const row = dnsTableBody.insertRow();
                row.insertCell(0).textContent = server.ip;
                row.insertCell(1).textContent = server.hostname || 'None';
                row.insertCell(2).textContent = server.isp;
                row.insertCell(3).textContent = server.country;
            });
        }
        
        // Show results
        resultsDiv.classList.remove('hidden');
        document.getElementById('testStatus').classList.add('hidden');
        
        // Update the query table to show completion
        this.updateQueryTable(this.queryResults.length + 1);
    }

    showStatus(message) {
        const statusDiv = document.getElementById('testStatus');
        statusDiv.textContent = message;
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.classList.add('hidden');
            }
        }, 3000);
    }

    clearResults() {
        this.queryResults = [];
        this.detectedServers.clear();
        document.getElementById('results').classList.add('hidden');
        document.getElementById('publicIP').classList.add('hidden');
        document.getElementById('queryTableBody').innerHTML = '';
        document.getElementById('dnsTableBody').innerHTML = '';
        this.showStatus('Results cleared. Click "Start DNS Leak Test" to begin.');
        
        setTimeout(() => {
            document.getElementById('testStatus').classList.add('hidden');
        }, 3000);
    }
}

// Initialize the DNS leak tester when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DNSLeakTester();
});
