document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const searchButton = document.getElementById('search-button');
    const searchButtonText = document.getElementById('search-button-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    const searchQuery = document.getElementById('search-query');
    const searchStatus = document.getElementById('search-status');
    const resultsSection = document.getElementById('results-section');
    const tableBody = document.getElementById('results-table-body');
    const exportButton = document.getElementById('export-button');

    // --- Variáveis de Estado e Configurações ---
    let searchResultsData = [];
    const WEBHOOK_URL = 'https://webhook.ia-tess.com.br/webhook/scraping-google-maps';
    const placeholders = [
        "Ex: Oficinas em Fernandópolis, SP",
        "Ex: Restaurantes em São Paulo, SP",
        "Ex: Advogados no Rio de Janeiro, RJ",
        "Ex: Padarias em Belo Horizonte, MG",
        "Ex: Clínicas veterinárias em Curitiba, PR"
    ];
    let placeholderIndex = 0;

    // --- Funções ---

    /**
     * Altera o placeholder do campo de busca periodicamente.
     */
    function cyclePlaceholders() {
        placeholderIndex = (placeholderIndex + 1) % placeholders.length;
        searchQuery.placeholder = placeholders[placeholderIndex];
    }
    setInterval(cyclePlaceholders, 3000); // Muda a cada 3 segundos

    /**
     * Controla a exibição do estado de carregamento.
     * @param {boolean} isLoading - True para mostrar o spinner, false para esconder.
     */
    function toggleLoading(isLoading) {
        searchButton.disabled = isLoading;
        if (isLoading) {
            searchButtonText.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
            searchStatus.textContent = 'Buscando e processando dados... Isso pode levar alguns minutos.';
        } else {
            searchButtonText.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
        }
    }

    /**
     * Popula a tabela com os dados da busca.
     * @param {Array<Object>} data - Array de objetos, cada um representando uma empresa.
     */
    function populateTable(data) {
        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">Nenhum resultado encontrado.</td></tr>`;
            searchStatus.textContent = 'A busca foi concluída, mas nenhum dado foi retornado.';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.Nome || '-'}</td>
                <td>${item.Telefone || '-'}</td>
                <td>${item.Categorias || '-'}</td>
                <td>${item.Endereço || '-'}</td>
                <td>${item.Website ? `<a href="http://${item.Website.replace(/^https?:\/\//,'')}" target="_blank" rel="noopener noreferrer">${item.Website}</a>` : '-'}</td>
            `;
            tableBody.appendChild(row);
        });

        resultsSection.classList.remove('hidden');
        exportButton.disabled = false;
        searchStatus.textContent = `Busca concluída! ${data.length} resultados encontrados.`;
    }

    /**
     * Função principal que executa a busca.
     */
    async function executeSearch() {
        const query = searchQuery.value.trim();
        if (!query) {
            searchStatus.textContent = 'Por favor, insira um termo de busca.';
            return;
        }

        toggleLoading(true);
        tableBody.innerHTML = '';
        exportButton.disabled = true;
        resultsSection.classList.add('hidden');

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ termo_de_busca: query }),
            });

            if (!response.ok) {
                throw new Error(`Erro na rede: ${response.statusText} (código: ${response.status})`);
            }

            const result = await response.json();
            let dataToDisplay = [];

            if (Array.isArray(result)) {
                dataToDisplay = result.map(item => ({
                    Nome: item.name,
                    Telefone: item.emails_and_contacts?.phone_numbers?.[0] || null,
                    Categorias: Array.isArray(item.subtypes) ? item.subtypes.join(', ') : '',
                    Endereço: item.address,
                    Website: item.website,
                    Cidade: item.city,
                    Estado: item.state,
                    CEP: item.zipcode,
                    Rating: item.rating,
                    'Quantidade de Avaliações': item.review_count
                }));
            } else {
                console.error("A resposta do Webhook não é um array:", result);
            }

            searchResultsData = dataToDisplay;
            populateTable(searchResultsData);

        } catch (error) {
            console.error('Erro ao chamar o webhook:', error);
            searchStatus.textContent = 'Ocorreu um erro ao buscar os dados. Tente novamente.';
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">Falha na comunicação com o servidor.</td></tr>`;
        } finally {
            toggleLoading(false);
        }
    }
    
    /**
     * Exporta os dados da tabela para um arquivo Excel.
     */
    function exportToExcel() {
        if (searchResultsData.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        const dataToExport = searchResultsData.map(item => ({
            'Nome da Empresa': item.Nome,
            'Telefone': item.Telefone,
            'Categorias': item.Categorias,
            'Endereço': item.Endereço,
            'Cidade': item.Cidade,
            'Estado': item.Estado,
            'CEP': item.CEP,
            'Website': item.Website,
            'Rating': item.Rating,
            'Quantidade de Avaliações': item['Quantidade de Avaliações']
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Empresas');

        worksheet['!cols'] = [
            { wch: 35 }, { wch: 20 }, { wch: 40 }, { wch: 45 }, { wch: 25 },
            { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 25 }
        ];

        XLSX.writeFile(workbook, 'busca_leads.xlsx');
    }

    // --- Lógica de Eventos ---
    searchButton.addEventListener('click', executeSearch);
    exportButton.addEventListener('click', exportToExcel);
    searchQuery.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            executeSearch();
        }
    });
});
