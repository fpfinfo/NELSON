/**
 * Gera um dataset "pivotado" por mês, com colunas JAN, FEV, ..., DEZ
 * Chaves: ANO, UG, Cód Favorecido, Nome Favorecido, Nat. Despes, Valor Pago (total)
 * Cada coluna de mês recebe o valor pago naquele mês
 */
export function pivotByMes(data: ParsedExcelData): ParsedExcelData {
  // Ordem e nomes padronizados para o CSV de saída (sem Valor Pago (R$))
  const meses = [
    "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
    "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
  ];
  const chaves = [
    "ANO", "UG", "Cód Favorecido", "Nome Favorecido", "Nat. Despes"
  ];
  const headerPadrao = [
    ...chaves,
    ...meses
  ];
  function normalizaMes(m: string) {
    return m.trim().slice(0,3).toUpperCase();
  }
  // Mapa para consolidar por chaves únicas
  const grupos = new Map<string, Record<string, string | number>>();
  for (const row of data.rows) {
    const mes = normalizaMes(row["MÊS"] || row["MES"] || "");
    if (!meses.includes(mes)) continue;
    const chave = chaves.map(c => row[c] || "").join("||");
    if (!grupos.has(chave)) {
      const base: Record<string, string | number> = {};
      chaves.forEach(c => base[c] = row[c] || "");
      meses.forEach(m => base[m] = "0,00");
      grupos.set(chave, base);
    }
    const grupo = grupos.get(chave)!;
    const valor = parseNumericValue(row["Valor Pago (R$)"] || row["Valor Pago"] || "0");
    // Soma o valor do mês (caso haja mais de uma linha para o mesmo mês)
    const valorMesAtual = parseNumericValue(grupo[mes] as string) || 0;
    grupo[mes] = floatToBrazilian(valorMesAtual + valor);
  }
  // Garante que todas as colunas estejam presentes e na ordem correta
  const rowsPadronizadas = Array.from(grupos.values()).map(row => {
    const novoRow: Record<string, string> = {};
    headerPadrao.forEach(h => {
      novoRow[h] = (row[h] as string) || "";
    });
    return novoRow;
  });
  return {
    headers: headerPadrao,
    rows: rowsPadronizadas,
    totalRows: rowsPadronizadas.length,
    fileName: data.fileName,
    sheetName: data.sheetName + " (pivot)"
  };
}

export function convertPivotToCSV(data: ParsedExcelData): string {
  const DELIMITER = ";";
  const headerLine = data.headers.join(DELIMITER);
  const dataLines = data.rows.map(row =>
    data.headers.map(h => row[h] || "").join(DELIMITER)
  );
  return headerLine + "\n" + dataLines.join("\n");
}

export async function downloadPivotCSV(data: ParsedExcelData, lgpd: boolean = false) {
  const exportData = lgpd ? applyLGPD(data) : data;
  const pivot = pivotByMes(exportData);
  const csvContent = convertPivotToCSV(pivot);
  const BOM = "\uFEFF";
  const fullContent = BOM + csvContent;
  const baseName = data.fileName.replace(/\.(xlsx|xls|csv)$/i, "").replace(/\s+/g, "_");
  const suggestedName = `${baseName}_consolidado_mensal.csv`;
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(fullContent);
  const blob = new Blob([uint8Array], { type: "text/csv;charset=utf-8;" });
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.warn("showSaveFilePicker falhou, usando fallback:", err);
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
}
import * as XLSX from "xlsx";

// ===================================================================
// Módulo: Conversor Excel → CSV Brasileiro
// Sistema: SGF-TJPA (Sistema de Gestão Financeira)
// Autor: SEFIN-TJPA
// ===================================================================

export interface ParsedExcelData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  fileName: string;
  sheetName: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Colunas obrigatórias conforme PRD §4.2
const REQUIRED_COLUMNS = [
  "MÊS",
  "ANO",
  "UG",
  "Cód Favorecido",
  "Nome Favorecido",
  "Nat. Despes",
  "Valor Pago (R$)",
] as const;

// Aliases para lidar com variações de nomes de colunas
const COLUMN_ALIASES: Record<string, string[]> = {
  "MÊS": ["MES", "MÊS", "Mês", "Mes", "mes", "mês"],
  "ANO": ["ANO", "Ano", "ano"],
  "UG": ["UG", "ug", "Ug", "UNIDADE GESTORA"],
  "Cód Favorecido": ["Cód Favorecido", "Cód. Favorecido", "COD FAVORECIDO", "CNPJ/CPF", "CPF/CNPJ", "Cod Favorecido", "Código Favorecido", "CÓDIGO FAVORECIDO", "Cód  Favorecido"],
  "Nome Favorecido": ["Nome Favorecido", "NOME FAVORECIDO", "Favorecido", "FAVORECIDO"],
  "Nat. Despes": ["Nat. Despes", "Nat. Despesa", "Nat. Despesas", "NAT. DESPES", "NAT. DESPESA", "Natureza Despesa", "NATUREZA DESPESA", "Nat Desp", "NAT DESP", "Nat. Desp", "Nat  Despesa"],
  "Valor Pago (R$)": ["Valor Pago (R$)", "VALOR PAGO (R$)", "Valor Pago", "VALOR PAGO", "ValorPago", "Valor_Pago", "Valor Pago(R$)"],
};

/**
 * Normaliza o nome de uma coluna encontrada na planilha
 * para o nome padrão definido no sistema
 */
function normalizeColumnName(rawName: string): string {
  // Normalizar espaços: remover non-breaking spaces, colapsar espaços duplos, trim
  const trimmed = rawName
    .replace(/\u00a0/g, " ")     // Non-breaking space → espaço normal
    .replace(/\s+/g, " ")        // Colapsar múltiplos espaços
    .trim();
    
  for (const [standard, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => {
      const normalizedAlias = alias.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      return normalizedAlias.toLowerCase() === trimmed.toLowerCase();
    })) {
      return standard;
    }
  }
  return trimmed;
}

/**
 * Faz o parse de um arquivo Excel e retorna os dados estruturados
 * Processamento 100% client-side (PRD §5 - Segurança)
 */
async function parseExcelData(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Usar a primeira sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converter para JSON com headers
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: false, // Manter como string para preservar formatação
        });

        if (rawData.length === 0) {
          reject(new Error("O arquivo está vazio ou não contém dados válidos."));
          return;
        }

        // Normalizar headers
        const rawHeaders = Object.keys(rawData[0]);
        const headerMap: Record<string, string> = {};
        rawHeaders.forEach((h) => {
          headerMap[h] = normalizeColumnName(h);
        });

        const normalizedHeaders = rawHeaders.map((h) => headerMap[h]);

        // Normalizar rows com headers padronizados
        const rows = rawData.map((row) => {
          const normalized: Record<string, string> = {};
          for (const [rawKey, value] of Object.entries(row)) {
            const normalizedKey = headerMap[rawKey] || rawKey;
            normalized[normalizedKey] = String(value);
          }
          return normalized;
        });

        resolve({
          headers: normalizedHeaders,
          rows,
          totalRows: rows.length,
          fileName: file.name,
          sheetName,
        });
      } catch (error) {
        reject(new Error(`Erro ao processar o arquivo: ${(error as Error).message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler o arquivo. Tente novamente."));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Faz o parse de um arquivo CSV com detecção automática de delimitador
 * Suporta delimitadores: ponto e vírgula (;) e vírgula (,)
 */
async function parseCsvData(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;

        if (!text || text.trim().length === 0) {
          reject(new Error("O arquivo CSV está vazio."));
          return;
        }

        // Remover BOM se presente
        const cleanText = text.replace(/^\uFEFF/, "");

        // Detectar delimitador: contar ocorrências de ; e , na primeira linha
        const firstLine = cleanText.split("\n")[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount >= commaCount ? ";" : ",";

        // Usar SheetJS para parsing consistente do CSV
        const workbook = XLSX.read(cleanText, {
          type: "string",
          FS: delimiter,
          raw: false,
        });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: false,
        });

        if (rawData.length === 0) {
          reject(new Error("O arquivo CSV não contém dados válidos."));
          return;
        }

        // Normalizar headers
        const rawHeaders = Object.keys(rawData[0]);
        const headerMap: Record<string, string> = {};
        rawHeaders.forEach((h) => {
          headerMap[h] = normalizeColumnName(h);
        });

        const normalizedHeaders = rawHeaders.map((h) => headerMap[h]);

        // Normalizar rows
        const rows = rawData.map((row) => {
          const normalized: Record<string, string> = {};
          for (const [rawKey, value] of Object.entries(row)) {
            const normalizedKey = headerMap[rawKey] || rawKey;
            normalized[normalizedKey] = String(value);
          }
          return normalized;
        });

        resolve({
          headers: normalizedHeaders,
          rows,
          totalRows: rows.length,
          fileName: file.name,
          sheetName: `CSV (${delimiter === ";" ? "ponto e vírgula" : "vírgula"})`,
        });
      } catch (error) {
        reject(new Error(`Erro ao processar o CSV: ${(error as Error).message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler o arquivo CSV. Tente novamente."));
    };

    // Tentar ler como UTF-8 primeiro
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Roteia o parse conforme a extensão do arquivo
 * Suporta: .xlsx, .xls (Excel) e .csv
 */
export async function parseFile(file: File): Promise<ParsedExcelData> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith(".csv")) {
    return parseCsvData(file);
  }
  return parseExcelData(file);
}

/**
 * Mescla múltiplos datasets parseados em um único dataset
 * - Headers: união de todos os headers (na ordem em que aparecem)
 * - Rows: concatena todas as linhas, preenchendo com "" colunas ausentes
 * - fileName: lista dos nomes separados por " + "
 */
export function mergeFiles(files: ParsedExcelData[]): ParsedExcelData {
  if (files.length === 0) {
    return { headers: [], rows: [], totalRows: 0, fileName: "", sheetName: "" };
  }
  if (files.length === 1) return files[0];

  // União ordenada de headers (preserva ordem de aparição)
  const headerSet = new Set<string>();
  for (const file of files) {
    for (const h of file.headers) {
      headerSet.add(h);
    }
  }
  const mergedHeaders = Array.from(headerSet);

  // Concatenar todas as rows, preenchendo colunas ausentes com ""
  const mergedRows: Record<string, string>[] = [];
  for (const file of files) {
    for (const row of file.rows) {
      const normalizedRow: Record<string, string> = {};
      for (const h of mergedHeaders) {
        normalizedRow[h] = row[h] || "";
      }
      mergedRows.push(normalizedRow);
    }
  }

  const fileNames = files.map((f) => f.fileName).join(" + ");

  return {
    headers: mergedHeaders,
    rows: mergedRows,
    totalRows: mergedRows.length,
    fileName: fileNames,
    sheetName: files.length > 1 ? `${files.length} arquivos mesclados` : files[0].sheetName,
  };
}

/**
 * Valida se os dados possuem todas as colunas obrigatórias (PRD §4.2)
 */
export function validateParsedData(data: ParsedExcelData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verificar colunas obrigatórias
  const missingColumns: string[] = [];
  for (const required of REQUIRED_COLUMNS) {
    if (!data.headers.includes(required)) {
      missingColumns.push(required);
    }
  }

  if (missingColumns.length > 0) {
    errors.push(
      `Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}`
    );
  }

  // Verificar se há dados
  if (data.totalRows === 0) {
    errors.push("O arquivo não contém linhas de dados.");
  }

  // Warnings para dados potencialmente problemáticos
  if (data.totalRows > 10000) {
    warnings.push(
      `O arquivo contém ${data.totalRows.toLocaleString("pt-BR")} linhas. O processamento pode ser mais lento.`
    );
  }

  // Verificar se há colunas extras (informativo)
  const extraColumns = data.headers.filter(
    (h) => !REQUIRED_COLUMNS.includes(h as typeof REQUIRED_COLUMNS[number])
  );
  if (extraColumns.length > 0) {
    warnings.push(
      `Colunas adicionais encontradas (serão incluídas no CSV): ${extraColumns.join(", ")}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Faz o parse de um valor numérico brasileiro/americano para float
 * Necessário para somar valores na consolidação
 */
function parseNumericValue(value: string): number {
  if (!value || value.trim() === "") return 0;

  let cleaned = value.trim();
  cleaned = cleaned.replace(/R\$\s*/g, "");
  cleaned = cleaned.trim();

  // Formato brasileiro: "135.878,15" → 135878.15
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
    cleaned = cleaned.replace(",", ".");
    return parseFloat(cleaned) || 0;
  }

  // Formato americano: "135,878.15" → 135878.15
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
    return parseFloat(cleaned) || 0;
  }

  // Número simples
  cleaned = cleaned.replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ===================================================================
// LGPD — Mascaramento de Dados Pessoais
// Conforme Lei 13.709/2018 + LAI (Lei 12.527/2011)
// ===================================================================

/** Termos que indicam PESSOA JURÍDICA no nome (dados públicos — não mascara) */
const CORPORATE_INDICATORS = [
  "S/A", "S.A.", "S.A", "LTDA", "LTD", "ME", "MEI", "EPP", "EIRELI",
  "BANCO", "CAIXA ECONOMICA", "CAIXA ECONÔMICA", "FUNDACAO", "FUNDAÇÃO",
  "ASSOCIACAO", "ASSOCIAÇÃO", "INSTITUTO", "COOPERATIVA", "PREFEITURA",
  "GOVERNO", "TRIBUNAL", "MINISTERIO", "MINISTÉRIO", "SECRETARIA",
  "UNIVERSIDADE", "CONSELHO", "COMPANHIA", "CIA.", "AGENCIA", "AGÊNCIA",
];

/** Detecta pessoa jurídica pelo NOME do favorecido */
function isPessoaJuridica(nome: string): boolean {
  if (!nome) return false;
  const upper = nome.toUpperCase().trim();
  return CORPORATE_INDICATORS.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(upper);
  });
}

/**
 * Mascara código de identificação para pessoa física
 * Funciona com qualquer tamanho (CPF, código interno, etc.)
 */
function maskCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  const len = digits.length;
  if (len <= 3) return "***";
  if (len <= 7) return "*".repeat(len - 2) + digits.slice(-2);
  if (len === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  if (len >= 14) return code; // CNPJ — manter
  const h = Math.floor(len * 0.3);
  return "*".repeat(h) + digits.slice(h, len - h) + "*".repeat(h);
}

/**
 * Abrevia nome de pessoa física para LGPD
 * Ex: "VALDELUCIA DE SOUSA MARQUES" → "V. DE S. MARQUES"
 * Ex: "JOSE MARIA DA SILVA" → "J. M. DA SILVA"
 * Mantém preposições (de, da, do, dos, das) e último sobrenome completo
 */
function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;

  const prepositions = new Set(["de", "da", "do", "dos", "das", "e", "DE", "DA", "DO", "DOS", "DAS", "E"]);
  const lastName = parts[parts.length - 1];

  const abbreviated = parts.slice(0, -1).map((part) => {
    if (prepositions.has(part)) return part;
    return `${part.charAt(0)}.`;
  });

  return [...abbreviated, lastName].join(" ");
}

/**
 * Aplica mascaramento LGPD nos dados parseados
 * Estratégia: detecta PJ pelo NOME (S/A, LTDA, BANCO, etc.)
 * - Pessoa Jurídica: mantém tudo (dado público)
 * - Pessoa Física: mascara código + abrevia nome
 */
export function applyLGPD(data: ParsedExcelData): ParsedExcelData {
  const maskedRows = data.rows.map((row) => {
    const newRow = { ...row };

    const nomeFavorecido = newRow["Nome Favorecido"] || "";
    const codFavorecido = newRow["Cód Favorecido"] || "";

    // Se é pessoa jurídica, mantém tudo íntegro
    if (isPessoaJuridica(nomeFavorecido)) {
      return newRow;
    }

    // Pessoa física → mascarar código e abreviar nome
    if (codFavorecido) {
      newRow["Cód Favorecido"] = maskCode(codFavorecido);
    }
    if (nomeFavorecido) {
      newRow["Nome Favorecido"] = abbreviateName(nomeFavorecido);
    }

    return newRow;
  });

  return {
    ...data,
    rows: maskedRows,
  };
}

/**
 * Formata um float para o padrão brasileiro sem milhar
 * Ex: 135878.15 → "135878,15"
 */
function floatToBrazilian(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Consolida os dados por Favorecido/Mês/Natureza.
 * Agrupa por: MÊS + ANO + UG + Cód Favorecido + Nat. Despes
 * Soma: Valor Pago (R$)
 * Mantém: Nome Favorecido (do primeiro registro do grupo)
 *
 * IMPORTANTE: Se as colunas-chave não existem nos dados,
 * retorna os dados originais sem consolidar.
 */
export function consolidateByFavorecido(
  data: ParsedExcelData
): ParsedExcelData {
  // Verificar se as colunas essenciais para consolidação existem
  const requiredForConsolidation = ["MÊS", "ANO", "Cód Favorecido", "Valor Pago (R$)"];
  const hasRequiredColumns = requiredForConsolidation.every(
    (col) => data.headers.includes(col)
  );

  if (!hasRequiredColumns) {
    // Sem colunas-chave, não consolidar — retornar dados originais
    return data;
  }
  const groups = new Map<
    string,
    { row: Record<string, string>; totalValue: number }
  >();

  for (const row of data.rows) {
    const key = [
      (row["MÊS"] || "").trim().toUpperCase(),
      (row["ANO"] || "").trim(),
      (row["UG"] || "").trim(),
      (row["Cód Favorecido"] || "").trim(),
      (row["Nat. Despes"] || "").trim(),
    ].join("|||");

    const valorPago = parseNumericValue(row["Valor Pago (R$)"] || "0");

    if (groups.has(key)) {
      const existing = groups.get(key)!;
      existing.totalValue += valorPago;
    } else {
      groups.set(key, {
        row: { ...row },
        totalValue: valorPago,
      });
    }
  }

  const consolidatedRows: Record<string, string>[] = [];
  for (const { row, totalValue } of groups.values()) {
    consolidatedRows.push({
      ...row,
      "Valor Pago (R$)": floatToBrazilian(totalValue),
    });
  }

  return {
    ...data,
    rows: consolidatedRows,
    totalRows: consolidatedRows.length,
  };
}

/**
 * Formata um valor numérico para o padrão brasileiro (PRD §4.4)
 * - Remove "R$", espaços
 * - Remove pontos de milhar
 * - Mantém vírgula como separador decimal
 */
function formatBrazilianNumber(value: string): string {
  if (!value || value.trim() === "") return "";

  let cleaned = value.trim();

  // Remover símbolo de moeda
  cleaned = cleaned.replace(/R\$\s*/g, "");
  cleaned = cleaned.trim();

  // Se o número já está no formato brasileiro (pontos como milhar, vírgula como decimal)
  // Ex: "135.878,15" → "135878,15"
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    // Formato brasileiro: remover pontos de milhar, manter vírgula decimal
    cleaned = cleaned.replace(/\./g, "");
    return cleaned;
  }

  // Se o número está no formato americano (vírgulas como milhar, ponto como decimal)
  // Ex: "135,878.15" → "135878,15"
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, ""); // remover vírgulas de milhar
    cleaned = cleaned.replace(".", ","); // trocar ponto decimal por vírgula
    return cleaned;
  }

  // Se é um número simples com ponto decimal (sem separadores de milhar)
  // Ex: "135878.15" → "135878,15"
  if (/^\d+\.\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(".", ",");
    return cleaned;
  }

  // Se é um número inteiro
  if (/^\d+$/.test(cleaned)) {
    return cleaned;
  }

  // Fallback: retornar como está
  return cleaned;
}

/**
 * Converte os dados parseados para CSV no padrão brasileiro (PRD §4.4)
 *
 * Regras:
 * - Delimitador: ponto e vírgula (;)
 * - Decimal: vírgula (,)
 * - Milhar: nenhum
 * - Codificação: UTF-8 com BOM
 * - Cód Favorecido: tratado como texto (preservar zeros à esquerda)
 */
export function convertToBrazilianCSV(data: ParsedExcelData): string {
  const DELIMITER = ";";

  // Colunas a exportar (usar apenas as obrigatórias na ordem correta)
  const exportColumns = REQUIRED_COLUMNS.filter((col) =>
    data.headers.includes(col)
  );

  // Header row
  const headerLine = exportColumns.join(DELIMITER);

  // Data rows
  const dataLines = data.rows.map((row) => {
    return exportColumns
      .map((col) => {
        const value = row[col] || "";

        // Valor Pago (R$) → formatação numérica brasileira
        if (col === "Valor Pago (R$)") {
          return formatBrazilianNumber(value);
        }

        // Cód Favorecido → tratar como texto (preservar zeros à esquerda)
        if (col === "Cód Favorecido") {
          // Se contém caracteres especiais (barras, pontos do CNPJ), manter
          // Garantir que zeros à esquerda sejam preservados
          return `"${value.replace(/"/g, '""')}"`;
        }

        // Nat. Despes → tratar como texto numérico
        if (col === "Nat. Despes") {
          return value;
        }

        // Campos de texto genéricos
        // Usar aspas se contém o delimitador ou aspas
        if (value.includes(DELIMITER) || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      })
      .join(DELIMITER);
  });

  return headerLine + "\n" + dataLines.join("\n");
}

/**
 * Gera o arquivo CSV com BOM UTF-8 e inicia o download
 * Usa File System Access API (showSaveFilePicker) para abrir o diálogo nativo
 * de "Salvar Como" — contorna completamente extensões de download
 * @param data - Dados parseados
 * @param consolidated - Se true, consolida por Favorecido/Mês antes de exportar
 * @param lgpd - Se true, aplica mascaramento LGPD (CPF, nomes)
 */
export async function downloadBrazilianCSV(
  data: ParsedExcelData,
  consolidated: boolean = false,
  lgpd: boolean = false
): Promise<void> {
  // Pipeline: LGPD → Consolidação → CSV
  let exportData = lgpd ? applyLGPD(data) : data;
  exportData = consolidated ? consolidateByFavorecido(exportData) : exportData;
  const csvContent = convertToBrazilianCSV(exportData);

  // UTF-8 BOM + conteúdo CSV
  const BOM = "\uFEFF";
  const fullContent = BOM + csvContent;

  // Nome do arquivo baseado no original
  const lgpdSuffix = lgpd ? "_lgpd" : "";
  const consolidatedSuffix = consolidated ? "_consolidado" : "";
  const baseName = data.fileName
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/\s+/g, "_");
  const suggestedName = `${baseName}${lgpdSuffix}${consolidatedSuffix}.csv`;

  // Converter para bytes
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(fullContent);
  const blob = new Blob([uint8Array], { type: "text/csv;charset=utf-8;" });

  // Tentar File System Access API (diálogo nativo "Salvar Como")
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "CSV (Separado por ponto e vírgula)",
            accept: { "text/csv": [".csv"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // Usuário cancelou o diálogo — não fazer nada
      if ((err as Error).name === "AbortError") return;
      // Fallback se a API falhar por outro motivo
      console.warn("showSaveFilePicker falhou, usando fallback:", err);
    }
  }

  // Fallback: download via link (para browsers sem File System Access API)
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
}

/**
 * Valida se o arquivo possui extensão aceita
 * Suporta: .xlsx, .xls e .csv
 */
export function isValidFile(file: File): boolean {
  const validExtensions = [".xlsx", ".xls", ".csv"];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}
