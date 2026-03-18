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
 * Exemplo real:
 *  - 3CORP JUL/2024 Nat 33909240 → R$ 59.152,83 (linha separada)
 *  - 3CORP JUL/2024 Nat 33904058 → R$ 77.684,54 (linha separada)
 *  - ANTOCAR JAN/2024 Nat 33903916 (6 linhas) → soma consolidada
 */
export function consolidateByFavorecido(
  data: ParsedExcelData
): ParsedExcelData {
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
 */
export async function downloadBrazilianCSV(
  data: ParsedExcelData,
  consolidated: boolean = false
): Promise<void> {
  const exportData = consolidated ? consolidateByFavorecido(data) : data;
  const csvContent = convertToBrazilianCSV(exportData);

  // UTF-8 BOM + conteúdo CSV
  const BOM = "\uFEFF";
  const fullContent = BOM + csvContent;

  // Nome do arquivo baseado no original
  const suffix = consolidated ? "_consolidado" : "";
  const baseName = data.fileName
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/\s+/g, "_");
  const suggestedName = `${baseName}${suffix}.csv`;

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
