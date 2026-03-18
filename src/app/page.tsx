"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Table2,
  FileDown,
  Loader2,
  ArrowRightLeft,
  Hash,
  Clock,
  Trash2,
  Layers,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  parseFile,
  validateParsedData,
  downloadBrazilianCSV,
  consolidateByFavorecido,
  isValidFile,
  type ParsedExcelData,
  type ValidationResult,
} from "@/lib/excel-to-csv";

// ===================================================================
// Página Principal: Conversor Excel → CSV Brasileiro
// Sistema: SGF-TJPA / SEFIN-TJPA
// ===================================================================

const MAX_PREVIEW_ROWS = 50;

export default function ConversorPage() {
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [isConsolidated, setIsConsolidated] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== Upload Handler =====
  const processFile = useCallback(async (file: File) => {
    setError(null);
    setParsedData(null);
    setValidation(null);
    setProcessingTime(null);

    // Validar extensão
    if (!isValidFile(file)) {
      setError(
        "Formato inválido. Apenas arquivos .xlsx, .xls e .csv são aceitos."
      );
      return;
    }

    setIsProcessing(true);
    const startTime = performance.now();

    try {
      // Parse do arquivo (Excel ou CSV)
      const data = await parseFile(file);

      // Validar colunas obrigatórias
      const result = validateParsedData(data);

      const elapsed = performance.now() - startTime;
      setProcessingTime(Math.round(elapsed));

      setParsedData(data);
      setValidation(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ===== Drag & Drop Handlers =====
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  // ===== Download Handler (PRD §4.4, §4.5) =====
  const handleDownload = useCallback(() => {
    if (parsedData) {
      downloadBrazilianCSV(parsedData, isConsolidated);
    }
  }, [parsedData, isConsolidated]);

  // ===== Reset =====
  const handleReset = useCallback(() => {
    setParsedData(null);
    setValidation(null);
    setError(null);
    setProcessingTime(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ===== Preview data (reactive to consolidation toggle) =====
  const displayData = useMemo(() => {
    if (!parsedData) return null;
    return isConsolidated ? consolidateByFavorecido(parsedData) : parsedData;
  }, [parsedData, isConsolidated]);

  const previewRows = displayData?.rows.slice(0, MAX_PREVIEW_ROWS) || [];
  const hasMoreRows = (displayData?.totalRows || 0) > MAX_PREVIEW_ROWS;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* ===== Page Header ===== */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Conversor para CSV Brasileiro
                </h1>
                <p className="text-sm text-muted-foreground">
                  Importe planilhas Excel ou CSV, consolide e exporte no formato CSV padrão brasileiro
                </p>
              </div>
            </div>
          </div>

          {parsedData && validation?.isValid && (
            <Button
              onClick={handleDownload}
              size="lg"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 animate-slide-up"
            >
              <Download className="h-4.5 w-4.5" />
              Baixar CSV Brasileiro
            </Button>
          )}
        </div>

        {/* ===== Summary Cards ===== */}
        {parsedData && displayData && (
          <div className="space-y-4 animate-slide-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Linhas Originais
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {parsedData.totalRows.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                      <Hash className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isConsolidated && (
                <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm">
                  <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-primary/70 uppercase tracking-wider">
                          Após Consolidação
                        </p>
                        <p className="text-2xl font-bold mt-1 text-primary">
                          {displayData.totalRows.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Colunas Mapeadas
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {parsedData.headers.length}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Table2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Arquivo Fonte
                      </p>
                      <p className="text-sm font-semibold mt-1.5 truncate max-w-[140px]" title={parsedData.fileName}>
                        {parsedData.fileName}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tempo de Processamento
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {processingTime
                          ? processingTime < 1000
                            ? `${processingTime}ms`
                            : `${(processingTime / 1000).toFixed(1)}s`
                          : "—"}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                      <Clock className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ===== Consolidation Toggle ===== */}
            <Card className={`border-border/50 backdrop-blur-sm transition-all duration-300 ${
              isConsolidated ? "bg-primary/5 border-primary/20" : "bg-card/80"
            }`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      isConsolidated ? "bg-primary/15" : "bg-muted/60"
                    }`}>
                      <Layers className={`h-4.5 w-4.5 transition-colors ${
                        isConsolidated ? "text-primary" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Consolidar por Favorecido / Mês
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Agrupa por MÊS + ANO + UG + Favorecido + Nat. Despesa e soma os valores pagos
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsConsolidated(!isConsolidated)}
                    className={`
                      relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
                      ${isConsolidated ? "bg-primary" : "bg-muted"}
                    `}
                    role="switch"
                    aria-checked={isConsolidated}
                    aria-label="Consolidar por Favorecido/Mês"
                    id="consolidation-toggle"
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0
                        transition-transform duration-300 ease-in-out
                        ${isConsolidated ? "translate-x-5" : "translate-x-0"}
                      `}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* ===== Action Buttons ===== */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleDownload}
                className="flex-1 gap-2 h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                id="download-csv-btn"
              >
                <Download className="h-5 w-5" />
                {isConsolidated ? "Baixar CSV Consolidado" : "Baixar CSV"}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="gap-2 h-11 border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                id="new-file-btn"
              >
                <RefreshCw className="h-4 w-4" />
                Novo Arquivo
              </Button>
            </div>
          </div>
        )}

        {/* ===== Error Alert ===== */}
        {error && (
          <Alert variant="destructive" className="animate-slide-up border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ===== Validation Warnings ===== */}
        {validation && !validation.isValid && (
          <Alert variant="destructive" className="animate-slide-up border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validação com Erros</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validation?.warnings && validation.warnings.length > 0 && (
          <Alert className="animate-slide-up border-amber-500/30 bg-amber-500/5 text-amber-400">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-400">Avisos</AlertTitle>
            <AlertDescription className="text-amber-400/80">
              <ul className="list-disc pl-4 mt-2 space-y-1">
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* ===== Upload Area (PRD §4.1) ===== */}
        {!parsedData && !isProcessing && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden animate-slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5 text-primary" />
                Upload de Planilha
              </CardTitle>
              <CardDescription>
                Carregue um arquivo Excel (.xlsx, .xls) ou CSV (.csv) com dados de despesas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center 
                  h-64 rounded-xl border-2 border-dashed cursor-pointer
                  transition-all duration-300 ease-in-out
                  ${
                    isDragOver
                      ? "border-primary bg-primary/5 drop-zone-active"
                      : "border-border/60 hover:border-primary/40 hover:bg-accent/30"
                  }
                `}
              >
                <div
                  className={`
                    flex h-16 w-16 items-center justify-center rounded-2xl mb-4
                    transition-all duration-300
                    ${
                      isDragOver
                        ? "bg-primary/15 scale-110"
                        : "bg-muted/60"
                    }
                  `}
                >
                  <FileSpreadsheet
                    className={`h-8 w-8 transition-colors ${
                      isDragOver ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>

                <p className="text-base font-medium text-foreground mb-1">
                  {isDragOver
                    ? "Solte o arquivo aqui"
                    : "Arraste e solte seu arquivo"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar
                </p>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono bg-secondary/80"
                  >
                    .xlsx
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono bg-secondary/80"
                  >
                    .xls
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono bg-secondary/80"
                  >
                    .csv
                  </Badge>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                />
              </div>

              {/* Regras de conversão */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-0.5">Padrão Brasileiro</p>
                    <p className="text-xs text-muted-foreground">
                      Delimitador: ponto e vírgula. Decimal: vírgula.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 mt-0.5">
                    <Info className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-0.5">UTF-8 com BOM</p>
                    <p className="text-xs text-muted-foreground">
                      Compatível com Excel e sistemas modernos.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 mt-0.5">
                    <FileDown className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-0.5">100% Local</p>
                    <p className="text-xs text-muted-foreground">
                      Dados processados no seu navegador. Nenhum envio externo.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== Processing Indicator ===== */}
        {isProcessing && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-slide-up">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <div className="absolute inset-0 h-12 w-12 rounded-full animate-pulse-glow" />
              </div>
              <p className="text-lg font-medium mt-6">
                Processando planilha...
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Analisando colunas e validando dados
              </p>
            </CardContent>
          </Card>
        )}

        {/* ===== Data Preview Table (PRD §4.3) ===== */}
        {parsedData && displayData && validation?.isValid && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-slide-up">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Table2 className="h-5 w-5 text-primary" />
                    Pré-visualização dos Dados
                    {isConsolidated && (
                      <Badge variant="secondary" className="ml-2 bg-primary/15 text-primary text-[10px] font-semibold">
                        Consolidado
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Exibindo{" "}
                    <span className="font-semibold text-foreground">
                      {Math.min(displayData.totalRows, MAX_PREVIEW_ROWS)}
                    </span>{" "}
                    de{" "}
                    <span className="font-semibold text-foreground">
                      {displayData.totalRows.toLocaleString("pt-BR")}
                    </span>{" "}
                    {isConsolidated ? "linhas consolidadas" : "linhas"}
                    {hasMoreRows && (
                      <span className="text-muted-foreground">
                        {" "}
                        — O arquivo CSV incluirá todas as linhas
                      </span>
                    )}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                  <Button
                    onClick={handleDownload}
                    size="sm"
                    className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/15"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="w-[50px] text-center text-xs font-semibold text-muted-foreground">
                        #
                      </TableHead>
                      {displayData.headers.map((header) => (
                        <TableHead
                          key={header}
                          className="text-xs font-semibold text-muted-foreground whitespace-nowrap"
                        >
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, rowIndex) => (
                      <TableRow
                        key={rowIndex}
                        className="border-border/30 hover:bg-accent/40 transition-colors"
                      >
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {rowIndex + 1}
                        </TableCell>
                        {displayData.headers.map((header) => (
                          <TableCell
                            key={header}
                            className={`text-sm whitespace-nowrap ${
                              header === "Valor Pago (R$)"
                                ? "text-right font-mono tabular-nums"
                                : header === "Cód Favorecido"
                                ? "font-mono text-xs"
                                : ""
                            }`}
                          >
                            {header === "Valor Pago (R$)" ? (
                              <span className="text-emerald-400">
                                {row[header]}
                              </span>
                            ) : (
                              row[header] || (
                                <span className="text-muted-foreground/40">
                                  —
                                </span>
                              )
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {hasMoreRows && (
                <div className="flex items-center justify-center py-4 border-t border-border/30">
                  <p className="text-sm text-muted-foreground">
                    +{" "}
                    {(displayData.totalRows - MAX_PREVIEW_ROWS).toLocaleString(
                      "pt-BR"
                    )}{" "}
                    linhas adicionais serão incluídas no CSV
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ===== Success State =====  */}
        {parsedData && validation?.isValid && (
          <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm animate-slide-up">
            <CardContent className="flex items-center gap-4 py-4 px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">
                  Arquivo validado com sucesso
                </p>
                <p className="text-xs text-primary/70 mt-0.5">
                  Todas as {parsedData.headers.length} colunas obrigatórias foram
                  mapeadas. O arquivo está pronto para exportação no formato CSV brasileiro.
                </p>
              </div>
              <Button
                onClick={handleDownload}
                variant="outline"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== Footer ===== */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground/50">
            SGF-TJPA v1.0 — Sistema de Gestão Financeira — SEFIN / Tribunal de
            Justiça do Estado do Pará
          </p>
        </div>
      </div>
    </AppShell>
  );
}
