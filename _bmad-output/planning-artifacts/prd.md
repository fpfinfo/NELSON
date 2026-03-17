---
stepsCompleted: ['step-01-init', 'step-02-discovery']
inputDocuments: ['image_0.png (UI Reference)', 'image_1.png (Excel Data Format)']
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 2
workflowType: 'prd'
---

# PRD: Módulo Conversor Excel para CSV Brasileiro (SEFIN-TJPA)

**Author:** Fabio.freitas
**Date:** 2026-03-17T14:02:00-03:00
**Projeto:** SGF-TJPA — Sistema de Gestão Financeira

---

## 1. Visão Geral do Produto

O objetivo deste módulo é permitir que os usuários façam upload de planilhas Excel,
visualizem os dados validados em tela e exportem estritamente no formato .csv padrão brasileiro.
Isso elimina erros manuais de formatação para importações em sistemas de terceiros ou módulos
de auditoria do Tribunal.

## 2. Stack Tecnológica

- **Framework:** Next.js (App Router) com React
- **Design System e UI:** Shadcn/UI + Tailwind CSS
- **Processamento de Arquivos:** Biblioteca `xlsx` (SheetJS) — client-side (privacidade de dados)
- **Backend:** Supabase (opcional para histórico de conversões; processamento de dados no navegador)

## 3. Diretrizes de Design & UX (OBRIGATÓRIO)

- **Integração no Painel:** Módulo acessível a partir do menu "Explorador"
- **Padrão Visual:** Cards, cards de resumo e tabelas Shadcn/UI
- **Topbar:** "SEFIN TJPA" + perfil do usuário
- **Área de Upload:** Card central e limpo com "drag and drop"

## 4. Requisitos Funcionais

### 4.1. Interface de Upload
- Área de upload centralizada e profissional
- "Arraste e solte" ou botão para "Selecionar Arquivo"
- Aceitar apenas `.xlsx` e `.xls`. Alerta de erro para outros formatos

### 4.2. Parsing e Validação de Dados
Colunas obrigatórias:
1. `MÊS`
2. `ANO`
3. `UG`
4. `Cód Favorecido` (CNPJ/CPF)
5. `Nome Favorecido`
6. `Nat. Despes`
7. `Valor Pago (R$)`

Avisar o usuário se colunas obrigatórias estiverem faltando ou arquivo vazio.

### 4.3. Pré-visualização de Dados (Data Table)
- Tabela Shadcn/UI com os dados para conferência
- Primeiras 50 linhas exibidas
- Botão proeminente: "Baixar CSV Brasileiro"

### 4.4. Motor de Exportação CSV (Padrão Brasileiro)
- **Delimitador:** Ponto e vírgula (`;`)
- **Separador Decimal:** Vírgula (`,`)
- **Separador de Milhar:** Nenhum
- **Campos Numéricos:** Remover "R$", remover pontos de milhar
- **Campos de Texto:** Manter conteúdo; Cód Favorecido como texto
- **Formato de Data:** Manter original (Mês abreviado + Ano)
- **Codificação:** UTF-8 com BOM

### 4.5. Interface de Download
- Download automático pelo navegador
- Nome: `conversao_despesas_sefin_[timestamp].csv`

## 5. Requisitos Não Funcionais
- **Performance:** Até 10.000 linhas em menos de 10 segundos
- **Segurança:** Processamento client-side; dados nunca enviados ao backend para conversão
