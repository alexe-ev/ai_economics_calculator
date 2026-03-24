# AI Economics Calculator: техническая спецификация

Интерактивный веб-калькулятор экономики AI-продуктов. Основан на фреймворках из AI Economics Study Guide (8 блоков). Позволяет PM и техлидам последовательно рассчитать стоимость inference, оптимизацию, роутинг, агентные цепочки, юнит-экономику, инфраструктуру и выйти на итоговый P&L.

---

## 1. Цель продукта

Калькулятор решает одну задачу: дать PM/техлиду сквозную модель экономики AI-продукта, от стоимости одного запроса до годового capacity plan. Пользователь заполняет входные параметры, калькулятор считает формулы из study guide и показывает результат с визуализацией.

Целевая аудитория: продакт-менеджеры, техлиды, CTO стартапов, которые строят продукты на LLM API.

Ключевое свойство: модули связаны между собой. Output одного модуля становится input следующего. Пользователь может пройти весь пайплайн от Block 01 до Block 08 или использовать любой модуль отдельно.

---

## 2. Модули калькулятора

### 2.1. Token Cost Calculator

**Источник:** Block 01, секции 02-04.

**Что считает:** стоимость одного API-запроса, стоимость за период, сравнение провайдеров.

**Входные параметры:**
- Текст запроса или ручной ввод: input_tokens, output_tokens
- Выбор модели (из справочника, секция 03)
- Язык текста (EN, RU, ZH, AR, другой) для коэффициента токенизации
- Модификаторы: Batch API (вкл/выкл), Prompt caching (вкл/выкл, cache hit rate %), Extended thinking (вкл/выкл, thinking_tokens)
- Объем: запросов в день / месяц

**Формулы:**

```
# Block 01, секция 02: базовая стоимость
cost = (input_tokens / 1M × input_price) + (output_tokens / 1M × output_price)

# Модификатор Batch API (секция 04): скидка 50%
cost_batch = cost × 0.5

# Модификатор Prompt caching (секция 04):
# cached_prefix_tokens оплачиваются по cache_read_rate (0.1x input)
# cache_write стоит 1.25x input (Anthropic)
cost_cached = (cached_tokens / 1M × input_price × 0.1)
            + (uncached_input / 1M × input_price)
            + (output_tokens / 1M × output_price)
# блендированная стоимость с cache hit rate:
blended = cache_hit_rate × cost_cached + (1 - cache_hit_rate) × cost_full

# Модификатор Extended thinking (секция 04):
# thinking_tokens оплачиваются как output
cost_thinking = (input_tokens / 1M × input_price)
              + ((output_tokens + thinking_tokens) / 1M × output_price)

# Коэффициент для не-латинских языков (секция 01): ×1.5-2.0
adjusted_tokens = tokens × language_multiplier
```

**Выходные данные:**
- Стоимость одного запроса (с разбивкой: input / output / thinking)
- Стоимость за месяц при заданном объеме
- Доля output в общей стоимости (%)
- Сравнительная таблица: та же задача на всех моделях из справочника

**Визуализация:**
- Столбчатая диаграмма: сравнение моделей по cost per request
- Pie chart: доля input vs output vs thinking в стоимости
- Индикатор: % от MRR (пользователь вводит MRR)

---

### 2.2. Optimization Stack Simulator

**Источник:** Block 02, секции 01-05.

**Что считает:** кумулятивную экономию от последовательного применения четырех уровней оптимизации. Каждый уровень включается/выключается, параметры настраиваются.

**Входные параметры (берутся из модуля 2.1 или вводятся вручную):**
- Baseline cost per request
- Input/output tokens per request
- Объем запросов в месяц
- Параметры каждого уровня:
  - **Output limits:** целевое кол-во output tokens (было/стало)
  - **Prompt caching:** размер кэшируемого префикса (tokens), cache hit rate (%), TTL
  - **Semantic cache:** доля FAQ-трафика (%), cache hit rate при threshold 0.8 (по умолчанию 67%), threshold (ползунок 0.7-0.95)
  - **Context management:** метод (truncation/summarization/RAG), % снижения input tokens (ползунок 20-80%)

**Формулы (пайплайн, Block 02, секция 05):**

```
# Layer 1: Output limits (секция 01)
# Пересчет output cost при новом количестве output tokens
cost_after_output = (input_tokens / 1M × input_price)
                  + (new_output_tokens / 1M × output_price)
savings_output = 1 - cost_after_output / baseline_cost

# Layer 2: Prompt caching (секция 02)
# Кэшируемый префикс: cached_prefix tokens по 0.1× input price
# Некэшированные tokens: по полной цене input
cost_cache_hit = (cached_prefix / 1M × input_price × 0.1)
               + ((input_tokens - cached_prefix) / 1M × input_price)
               + (new_output_tokens / 1M × output_price)
cost_cache_miss = cost_after_output  # полная цена
blended_after_cache = cache_hit_rate × cost_cache_hit
                    + (1 - cache_hit_rate) × cost_cache_miss

# Layer 3: Semantic cache (секция 03)
# faq_share × semantic_hit_rate = доля трафика, обслуженного из кэша (cost = 0)
cache_deflection_rate = faq_share × semantic_hit_rate
cost_after_semantic = (1 - cache_deflection_rate) × blended_after_cache
# (embedding cost ~$0.000002 per query — добавляется, но пренебрежимо мал)

# Layer 4: Context management (секция 04)
# Уменьшение input tokens на remaining трафике
reduced_input = input_tokens × (1 - context_reduction_pct)
cost_after_context = (reduced_input / 1M × input_price)
                   + (new_output_tokens / 1M × output_price)
# Применяется поверх prompt caching: пересчитывается blended

# Итоговая кумулятивная экономия
cumulative_savings = 1 - final_monthly_cost / baseline_monthly_cost
```

**Выходные данные:**
- Стоимость на каждом уровне (по одному запросу и за месяц)
- Кумулятивная экономия после каждого уровня (%)
- Waterfall: $baseline → после output limits → после caching → после semantic cache → после context mgmt

**Визуализация:**
- Waterfall chart (ступенчатое снижение стоимости по уровням)
- Таблица: слой / effort / savings % / monthly $
- Прогрессия в стиле Kairos Case Study (Block 02)

---

### 2.3. Model Selection Scorer

**Источник:** Block 03, секции 01-04.

**Что считает:** взвешенный скор для каждой модели-кандидата по трем осям (quality, cost, latency) с учетом приоритетов продукта.

**Входные параметры:**
- Тип задачи (classification, extraction, Q&A, summarization, coding, complex reasoning)
- Модели-кандидаты (2-5 моделей): для каждой:
  - Quality score (% по eval, ввод вручную)
  - Cost per request ($)
  - Latency P50 (ms)
- Веса (предустановки или ручной ввод):
  - Support chat: quality 0.4, cost 0.2, latency 0.4
  - Batch pipeline: quality 0.3, cost 0.6, latency 0.1
  - Medical/legal: quality 0.7, cost 0.1, latency 0.2
  - Custom: три ползунка, сумма = 1.0

**Формулы (Block 03, секция 04):**

```
# Нормализация каждой метрики к 0-1 (лучший в наборе = 1.0)
quality_norm[i] = quality[i] / max(quality)
cost_norm[i] = (1/cost[i]) / max(1/cost)     # инверсия: дешевле = лучше
latency_norm[i] = (1/latency[i]) / max(1/latency)  # инверсия: быстрее = лучше

# Weighted score
score[i] = quality_norm[i] × w_quality
         + cost_norm[i] × w_cost
         + latency_norm[i] × w_latency
```

**Выходные данные:**
- Рейтинг моделей (отсортировано по score)
- Для каждой модели: нормализованные значения, итоговый score
- Пометка "победитель" и gap до второго места
- Текстовая интерпретация: "Haiku at 94% vs Sonnet at 96%: +2% quality for 4.3x cost"

**Визуализация:**
- Radar chart (spider diagram) для каждой модели: quality, 1/cost, 1/latency
- Scatter plot: quality vs cost (визуализация frontier)
- Bar chart: итоговые scores

---

### 2.4. Cascade Routing Calculator

**Источник:** Block 03, секции 06-07.

**Что считает:** blended cost при каскадном роутинге трафика через несколько уровней моделей, включая стоимость классификатора.

**Входные параметры:**
- Общий объем запросов в месяц
- Классификатор: модель (из справочника), cost per request
- Уровни (тиры), 2-4 штуки. Для каждого:
  - Модель
  - % трафика (сумма = 100%)
  - Cost per request (из модуля 2.1 или вручную)
  - Quality score (%)

**Формулы (Block 03, секция 06):**

```
# Стоимость классификатора на весь объем
classifier_cost = volume × classifier_cost_per_req

# Стоимость каждого тира
tier_cost[i] = volume × traffic_pct[i] × cost_per_req[i]

# Общая стоимость
total = classifier_cost + Σ(tier_cost[i])

# Blended cost per request
blended_cost = total / volume

# Blended quality (взвешенная средняя)
blended_quality = Σ(traffic_pct[i] × quality[i])

# Сравнение: все на дорогой модели vs каскад
all_expensive = volume × max(cost_per_req)
savings = 1 - total / all_expensive
```

**Выходные данные:**
- Blended cost per request
- Total monthly cost
- Blended quality
- Savings vs all-on-expensive
- Разбивка по тирам: volume / cost / quality

**Визуализация:**
- Stacked bar chart: доля стоимости по тирам
- Funnel diagram: трафик через classifier → tier 1 / tier 2 / tier 3
- Сравнительная таблица: cascade vs single-model

---

### 2.5. Quality-Cost Boundary Calculator

**Источник:** Block 03, секция 07.

**Что считает:** принимать ли переключение на дешевую модель, с учетом downstream cost ошибок.

**Входные параметры:**
- Объем запросов для задачи
- Текущая (дорогая) модель: cost per request, accuracy %
- Кандидат (дешевая) модель: cost per request, accuracy %
- Cost per error ($): стоимость одной ошибки (rerouting time, человеко-часы, churn impact)
- Fallback catch rate (%): доля ошибок, которые ловит автоматический fallback

**Формулы (Block 03, секция 07):**

```
inference_savings = volume × (cost_expensive - cost_cheap)
error_increase = volume × (accuracy_expensive - accuracy_cheap)
downstream_cost = error_increase × cost_per_error × (1 - fallback_catch_rate)

# Fallback retry cost (optional)
fallback_cost = error_increase × fallback_catch_rate × cost_expensive

# Net benefit
net = inference_savings - downstream_cost - fallback_cost

# Decision
if net > 0: "Accept the cheaper model"
if net < 0: "Keep the expensive model"
```

**Выходные данные:**
- Inference savings ($/mo)
- Error increase (количество / месяц)
- Downstream cost ($/mo)
- Fallback retry cost ($/mo)
- Net benefit ($/mo)
- Рекомендация: accept / reject с обоснованием
- Breakeven: при каком cost_per_error переключение перестает быть выгодным

**Визуализация:**
- Waterfall: savings → minus downstream → minus fallback → net
- Sensitivity chart: net benefit при разных fallback_catch_rate (20%, 40%, 60%, 80%)

---

### 2.6. Latency Budget Builder

**Источник:** Block 04, секции 03, 06, 07.

**Что считает:** декомпозицию e2e latency по компонентам, perceived TTFT, соответствие UX-порогам.

**Входные параметры:**
- Компоненты (для каждого: P50 и P95 в ms):
  - Network overhead
  - Embedding query
  - Vector retrieval
  - Reranking
  - LLM TTFT (из справочника или вручную)
  - Token generation: output_tokens, ITL (ms) или TPS
  - Post-processing
- Streaming: вкл/выкл
- Target P95 (ms)

**Формулы (Block 04, секция 03, 06):**

```
# End-to-end latency (Block 04, секция 03)
e2e = TTFT + (output_tokens × ITL)

# При streaming: perceived latency = pre-LLM pipeline + API TTFT
pre_llm = network + embedding + retrieval + reranking
perceived_ttft = pre_llm + llm_ttft

# Без streaming: perceived = полный e2e + post-processing
perceived_no_stream = pre_llm + TTFT + (output_tokens × ITL) + post_processing

# UX threshold classification (Block 04, секция 04)
if perceived < 200ms: "Instant"
elif perceived < 1000ms: "Comfortable"
elif perceived < 3000ms: "Noticeable, tolerable with streaming"
else: "Abandonment risk"

# Budget compliance
budget_used = Σ(component P95)
budget_remaining = target_p95 - budget_used
if budget_remaining < 0: "Over budget by {abs(budget_remaining)}ms"
```

**Выходные данные:**
- e2e P50 и P95
- Perceived TTFT (со streaming и без)
- UX classification (instant / comfortable / tolerable / abandonment)
- Budget compliance: каждый компонент как % от общего бюджета
- Bottleneck: компонент, занимающий наибольшую долю

**Визуализация:**
- Stacked horizontal bar: компоненты как сегменты e2e latency
- Gauge indicator: perceived TTFT vs UX thresholds (зеленый / желтый / красный)
- Таблица: компонент / P50 / P95 / % бюджета / bottleneck flag

---

### 2.7. Agent Cost Estimator

**Источник:** Block 05, секции 01-06.

**Что считает:** стоимость агентной цепочки с учетом роста контекста, tool use overhead, multi-agent overhead.

**Входные параметры:**
- Количество шагов в цепочке (1-15)
- Для каждого шага:
  - Новые input tokens (помимо контекста)
  - Output tokens
  - Модель (из справочника)
  - Tool use: да/нет
- Tool definitions: количество инструментов, средний размер определения (tokens)
- Tool use system overhead: 300-700 tokens (по умолчанию 500)
- Режим: single-agent или multi-agent
  - Multi-agent: количество specialists, orchestrator model, communication overhead tokens per handoff
- Fallback: retry rate (%), escalation model

**Формулы (Block 05, секции 01-03, 06):**

```
# Context accumulation (Block 05, секция 02)
# Каждый шаг несет весь предыдущий контекст
context[0] = initial_input
context[i] = context[i-1] + output[i-1] + tool_result[i-1] + new_input[i]

# Tool definition overhead (Block 05, секция 03)
# Добавляется к КАЖДОМУ вызову в цепочке
tool_overhead = tool_system_prompt + (num_tools × avg_tool_def_size)
effective_input[i] = context[i] + tool_overhead

# Cost per step
cost_step[i] = (effective_input[i] / 1M × input_price)
             + (output[i] / 1M × output_price)

# Cost per intent (Block 05, секция 01)
cost_per_intent = Σ(cost_step[i])

# Multi-agent overhead (Block 05, секция 06)
# orchestrator_cost + Σ(specialist costs) + communication_overhead
orchestrator_cost = 1 × orch_cost_per_call
specialist_costs = Σ(specialist_calls × specialist_cost)
communication_overhead = num_handoffs × handoff_tokens / 1M × input_price × 2
# (×2: orchestrator receives + forwards)
total_multi_agent = orchestrator_cost + specialist_costs + communication_overhead

# Cost per successful outcome (Block 05, секция 01)
cost_per_outcome = total_cost / success_rate

# Agent chain latency (Block 05, секция 02)
e2e_agent_latency = Σ(TTFT[i]) + Σ(output_tokens[i] × ITL[i])
                  + Σ(tool_execution_time[i])
```

**Выходные данные:**
- Cost per step (таблица: step / context size / input cost / output cost / total)
- Cost per intent (сумма всех шагов)
- Cost per successful outcome (с учетом success rate)
- Кратность к single-call cost (e.g., "5.8x Block 01 baseline")
- Agent chain latency (e2e)
- Tool definition overhead ($ per chain, % от total)
- Multi-agent overhead ($ per intent, % от total)

**Визуализация:**
- Area chart: рост контекста по шагам (tokens)
- Stacked bar: cost per step (input vs output vs tool overhead)
- Cumulative line: нарастающая стоимость цепочки
- Таблица: single-agent vs multi-agent comparison

---

### 2.8. Cost Explosion Risk Calculator

**Источник:** Block 05, секции 07-08.

**Что считает:** потенциальный ущерб от failure patterns и размер budget caps.

**Входные параметры:**
- Общий объем запросов в месяц
- Baseline cost per intent (из модуля 2.7)
- % трафика, попадающего в failure patterns (по умолчанию 5%)
- Средняя стоимость failure-ticket (или разбивка по паттернам):
  - Pattern 1 (infinite retry): avg cost
  - Pattern 2 (context explosion): avg cost
  - Pattern 3 (tool cascade): avg cost
  - Pattern 4 (escalation spiral): avg cost
  - Pattern 5 (tool hammering): avg cost
  - Pattern 9 (escalation penalty): avg cost, включая доп. время человека
- Параметры budget caps:
  - Per-intent cap ($)
  - Per-tenant cap ($/month)
  - System circuit breaker ($/hour)

**Формулы (Block 05, секции 07-08):**

```
# Без budget caps
failure_tickets = volume × failure_rate
additional_cost_uncapped = failure_tickets × avg_failure_cost
total_uncapped = (volume × baseline_cost) + additional_cost_uncapped
pct_budget_from_tail = additional_cost_uncapped / total_uncapped

# С budget caps
# Каждый failure-ticket ограничен per_intent_cap
capped_failure_cost = min(avg_failure_cost, per_intent_cap)
additional_cost_capped = failure_tickets × capped_failure_cost
total_capped = (volume × baseline_cost) + additional_cost_capped
savings_from_caps = additional_cost_uncapped - additional_cost_capped

# Worst case: cascading retries (Block 05, секция 04)
worst_case = haiku_retries × haiku_cost_escalated
           + sonnet_retries × sonnet_cost_escalated
           + opus_final × opus_cost_escalated
# (с учетом растущего контекста на каждом retry)

# Hidden infrastructure overhead (Pattern 8, Block 05)
infra_overhead = total_inference × infra_overhead_pct  # 15-25%

# Budget cap sizing recommendations
recommended_per_intent = baseline_cost × 8  # ~8x baseline как стартовая точка
```

**Выходные данные:**
- Total cost без caps vs с caps
- Savings from caps ($/mo)
- % бюджета, потребляемый failure tail
- Worst-case scenario: один ticket без cap
- Рекомендованные budget caps (per-intent, per-tenant, circuit breaker)
- Infrastructure overhead estimate

**Визуализация:**
- Side-by-side bar: cost with caps vs without
- Pie chart: normal traffic cost vs failure tail cost
- Distribution chart: cost per ticket histogram с отметкой budget cap

---

### 2.9. Unit Economics Dashboard

**Источник:** Block 06, секции 01-07.

**Что считает:** полную структуру COGS, gross margin, распределение стоимости по сегментам пользователей, выявление power users.

**Входные параметры:**
- Revenue:
  - Subscription price ($/user/month)
  - Кол-во пользователей
  - Альтернатива: platform fee + per-agent fee
  - MRR (рассчитывается автоматически или вводится)
- COGS компоненты:
  - Inference cost ($/mo) — из модулей 2.1-2.7 или вручную
  - Embedding API ($/mo)
  - Vector DB hosting ($/mo)
  - Monitoring/observability ($/mo)
  - Fine-tuning cost amortized ($/mo)
  - Error overhead / retries (%)
  - Safety/guardrails overhead (%)
- User distribution (2-4 сегмента):
  - Для каждого: % пользователей, avg requests/mo, avg cost per request
- Human alternative cost per outcome ($)
- AI resolution rate (%)

**Формулы (Block 06, секции 01, 03, 06):**

```
# Full COGS per request (Block 06, секция 01)
cogs_per_req = inference_cost + embedding_cost
             + (vector_db / total_requests)
             + (monitoring / total_requests)

# COGS per user per month (Block 06, секция 03)
cogs_per_user = avg_requests × cogs_per_req + infra_per_user

# Gross margin (Block 06, секция 03)
gross_profit = revenue_per_user - cogs_per_user
gross_margin = gross_profit / revenue_per_user × 100%

# Margin zone classification (Block 06, секция 10)
if gross_margin > 70%: "Healthy"
elif gross_margin > 60%: "Monitor"
elif gross_margin > 50%: "Action needed"
else: "Critical"

# Per-segment analysis
for segment in segments:
    segment.cogs = segment.avg_requests × segment.cost_per_req + infra_per_user
    segment.margin = (revenue_per_user - segment.cogs) / revenue_per_user × 100%

# Cost per successful outcome (Block 06, секция 06)
cost_per_resolved = total_cogs / (volume × resolution_rate)

# Blended cost per problem solved (Block 06, секция 06)
blended = (resolution_rate × avg_ai_cost) + ((1 - resolution_rate) × human_cost)

# Breakeven resolution rate (Block 06, секция 06)
# total_ai_system_cost < all_human_cost
# inference + infra + engineering < volume × human_cost
# r > (inference + infra + eng) / (volume × human_cost)
breakeven_rate = total_ai_overhead / (volume × human_cost)
```

**Выходные данные:**
- Fleet COGS ($/mo), breakdown по компонентам
- Fleet gross margin (%), зона (healthy / monitor / action / critical)
- COGS per user (average, P90, P99)
- Per-segment table: segment / users / requests / cost per user / margin
- Power user detection: сегменты с negative margin выделяются красным
- Cost per resolved outcome vs human alternative
- Breakeven resolution rate

**Визуализация:**
- COGS breakdown pie chart (inference, vector DB, monitoring, embedding, other)
- User cost distribution histogram с линией subscription price
- Margin zone gauge (стрелка на шкале 0-100%)
- Comparison bar: AI cost per outcome vs human cost per outcome
- Multi-view toggle: fleet average / per-segment / P90-P99 (Block 06, секция 04)

---

### 2.10. Pricing Model Simulator

**Источник:** Block 06, секции 07-08.

**Что считает:** результат разных pricing-архетипов при заданном распределении пользователей.

**Входные параметры:**
- User distribution (из модуля 2.9 или новый ввод):
  - Количество пользователей по сегментам
  - Requests per user per month (по сегментам)
- COGS per user (из модуля 2.9 или вручную)
- Pricing model (выбор из 4 архетипов, можно сравнить 2-3 одновременно):
  - **Usage-based:** base fee + per-unit above threshold. Параметры: base fee, free tier units, per-unit price
  - **Outcome-based:** per-resolved-outcome price. Параметры: price per outcome, resolution rate
  - **Tiered with caps:** 2-4 тира. Для каждого: price, included units, overage price
  - **Cascade pricing:** free tier (cheap model), pro (mid model), enterprise (expensive model). Per-tier: price, model, cost per request

**Формулы:**

```
# Usage-based (Block 06, секция 08, Option A)
revenue_user[i] = base_fee + max(0, requests[i] - free_units) × per_unit
margin_user[i] = (revenue_user[i] - cogs_user[i]) / revenue_user[i]

# Outcome-based (Block 06, секция 08, Option B)
resolved = volume × resolution_rate
revenue_total = resolved × price_per_outcome
margin = (revenue_total - total_cogs) / revenue_total

# Tiered with caps (Block 06, секция 08, Option C)
# Пользователь попадает в тир по usage
tier = select_tier(requests[i])
revenue_user[i] = tier.price + max(0, requests[i] - tier.included) × tier.overage

# Cascade pricing
# Разные модели по тирам, стоимость привязана к модели
cost_free = requests × cost_haiku
cost_pro = requests × cost_sonnet
cost_enterprise = requests × cost_opus
```

**Выходные данные (для каждого архетипа):**
- Total MRR
- Fleet gross margin
- Per-segment margin
- Revenue per user distribution
- Worst-case user margin (power user)
- Comparison table: все архетипы рядом

**Визуализация:**
- Side-by-side bar chart: MRR / margin / worst-case margin для каждого архетипа
- Distribution chart: revenue per user vs cost per user по сегментам
- Sensitivity: margin при разных resolution rates (для outcome-based)

---

### 2.11. Infrastructure Breakeven Calculator

**Источник:** Block 07, секции 01-03, 08.

**Что считает:** при каком объеме self-hosting становится выгоднее API, с учетом полного TCO.

**Входные параметры:**
- Для API варианта:
  - Модель (из справочника)
  - Requests per month
  - Cost per request (из модуля 2.1 или вручную)
- Для self-hosted варианта:
  - GPU (из справочника GPU)
  - Количество GPU
  - Pricing model: on-demand / reserved / spot
  - GPU $/hr
  - Expected utilization (%)
  - Ops overhead: standalone (0.25-0.5 FTE) или marginal (0.1-0.15 FTE)
  - FTE loaded cost ($/yr, по умолчанию $175,000)
  - Infra tooling ($/mo): monitoring, serving framework, redundancy
- Open-weight model tier (7B-8B / 13B / 70B+)
- Quality delta: open-weight accuracy % vs API accuracy % (из eval)
- Fine-tuning: вкл/выкл
  - Dataset cost, training cost, re-training frequency

**Формулы (Block 07, секция 01):**

```
# Monthly API cost
monthly_api = requests × cost_per_request_api

# Monthly self-hosted TCO (Block 07, секция 01)
gpu_monthly = num_gpus × gpu_hourly × 730  # hours per month
ops_monthly = fte_fraction × fte_annual / 12
infra_monthly = monitoring + serving + redundancy
self_hosted_tco = gpu_monthly + ops_monthly + infra_monthly

# Cost per request self-hosted
# Throughput: req/s (из справочника GPU) × utilization
effective_throughput = throughput_per_gpu × num_gpus × utilization
max_monthly_requests = effective_throughput × 3600 × 24 × 30
cost_per_req_self = self_hosted_tco / actual_requests

# Breakeven (Block 07, секция 01)
breakeven_requests = self_hosted_tco / cost_per_request_api
# Breakeven API spend
breakeven_api_spend = self_hosted_tco

# Utilization impact (Block 07, секция 08)
cost_at_utilization = gpu_monthly / utilization + ops_monthly + infra_monthly
```

**Выходные данные:**
- API monthly cost vs self-hosted TCO
- Cost per request: API vs self-hosted
- Breakeven point: requests/month и $/month
- Savings at current volume ($/mo)
- Utilization impact table: cost at 30%, 50%, 70%, 100%
- TCO breakdown: GPU / ops / infra (pie chart)
- Quality trade-off note: accuracy API vs self-hosted

**Визуализация:**
- Crossover chart: две линии (API cost и self-hosted cost) по оси X = volume, пересечение = breakeven
- TCO breakdown stacked bar
- Utilization sensitivity table (как в Block 07, секция 08)

**Fine-tuning ROI sub-calculator (Block 07, секция 03):**

```
fine_tune_ROI = (api_cost_monthly - self_hosted_fine_tuned_monthly) × months
              - dataset_cost - training_cost - incremental_ops
breakeven_months = (dataset_cost + training_cost + incremental_ops)
                 / (api_cost_monthly - self_hosted_fine_tuned_monthly)
```

---

### 2.12. Capacity Planning Projector

**Источник:** Block 07, секция 05.

**Что считает:** прогноз COGS, revenue и margin на 3-12 месяцев по трем сценариям.

**Входные параметры:**
- Текущие значения (month 0):
  - Users, requests/user, cost/request, revenue/user
  - Total COGS, total revenue, margin
- Прогнозные переменные:
  - User growth rate (% per quarter)
  - Usage growth: calls per user change (e.g., +40% from agent features)
  - LLMflation: cost per token decline (% per year, по умолчанию -10x/yr, т.е. примерно -70% за год)
  - Optimization savings (% per quarter)
  - Revenue per user change (new pricing tiers)
  - Infra changes (self-hosting threshold)

**Три сценария (Block 07, секция 05):**

```
# Conservative: users grow, everything else flat
scenario_a.cost = future_users × current_requests_per_user × current_cost_per_req

# Realistic: users grow + features increase usage + LLMflation + optimization
scenario_b.cost_per_req = current × usage_multiplier × llmflation_factor
                        × optimization_factor
scenario_b.cost = future_users × future_requests × scenario_b.cost_per_req

# Aggressive with hybrid: добавляет self-hosting tier
scenario_c.api_cost = api_traffic × scenario_b.cost_per_req
scenario_c.self_hosted = self_hosted_tco
scenario_c.total = scenario_c.api_cost + scenario_c.self_hosted + infra
```

**Выходные данные:**
- Таблица: month 0 / month 3 / month 6 / month 12 для каждого сценария
- По каждому: users, tickets/mo, cost/ticket, COGS, revenue, margin
- Delta: изменение margin между сценариями

**Визуализация:**
- Line chart: три сценария COGS по времени
- Line chart: три сценария margin по времени
- Stacked area: COGS breakdown (API vs self-hosted vs infra) для scenario C
- Summary table в стиле Kairos progression (Block 07 case study)

---

### 2.13. Pre-Launch Economics Brief Generator

**Источник:** Block 08, секция 01.

**Что делает:** генерирует заполненный шаблон Economics Brief на основе данных из других модулей.

**Входные параметры (часть подтягивается из других модулей):**
- Task description (текст)
- Estimated tokens/request: input + output (из модуля 2.1)
- Expected volume: req/day, req/month (ввод)
- Model tier + reason (из модуля 2.3)
- Projected cost/request (из модуля 2.1)
- Projected cost/month (расчет)
- Alternative: human cost per unit (ввод)
- Break-even volume (расчет)

**Шаблон (Block 08, секция 01):**

```
Task: {task_description}
Estimated tokens/request: input {X} + output {Y}
Expected volume: {daily} /day → {monthly} /month
Model tier: {model} — reason: {reason}
Projected cost/request: {cost_formula} = ${cost}
Projected cost/month: ${cost} × {volume} = ${monthly}
Alternative: {alternative_description} at ${alt_cost}/unit
Break-even: AI is cheaper from request #{breakeven_volume}
          (or: AI break-even at {breakeven_pct}% resolution rate)
```

**Выходные данные:**
- Заполненный brief (copyable / downloadable)
- Флаги: если >2 полей "unknown", предупреждение
- Comparison: AI cost vs alternative (ratio)

---

### 2.14. Weekly Cost Review Template

**Источник:** Block 08, секция 04.

**Что делает:** структурированный шаблон еженедельного review, заполняемый данными из дашборда.

**Входные параметры:**
- Total spend this week ($)
- Weekly budget ($)
- Cost per outcome: this week vs last week
- P99 cost per request: this week vs last week
- Anomalies (текст, опциональные заметки)
- One optimization to investigate (текст)

**Шаблон (Block 08, секция 04):**

```
Week of: {date}

1. Spend vs budget: ${actual} / ${budget} ({over/under} by {delta}%)
2. Cost per outcome: ${this_week} (last week: ${last_week}, trend: {↑/↓/→})
3. P99 cost: ${p99_this} (last week: ${p99_last}, trend: {↑/↓/→})
4. Anomalies: {text or "None"}
5. Optimization to investigate: {text}

Status: {Green / Yellow / Red}
```

**Выходные данные:**
- Заполненный review (copyable / downloadable)
- Status indicator на основе правил:
  - Green: spend <= budget, cost per outcome stable or improving
  - Yellow: spend 100-120% budget, или cost per outcome growing
  - Red: spend >120% budget, или P99 >2x last week

---

## 3. Данные и справочники

Все справочные данные отмечены как SNAPSHOT и привязаны к дате. Пользователь видит дату актуальности и может перезаписать любое значение вручную.

### 3.1. Цены моделей (SNAPSHOT: March 2026)

Из Block 01, секция 03:

| Модель | Input $/MTok | Output $/MTok | Context |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | 1M |
| Grok 4.1 Fast | $0.20 | $0.50 | 2M |
| Gemini 3 Flash | $0.50 | $3.00 | 1M |
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K |
| GPT-5.2 | $1.75 | $14.00 | 400K |
| Gemini 3.1 Pro | $2.00 | $12.00 | 200K+ |
| GPT-5.4 | $2.50 | $15.00 | 1M |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 200K/1M |
| Claude Opus 4.6 | $5.00 | $25.00 | 200K/1M |

Возможность добавить custom model (ввод name, input price, output price).

### 3.2. Cache pricing (SNAPSHOT: March 2026)

Из Block 01/02:

| Provider | Cache Write | Cache Read | TTL | Min Tokens |
|---|---|---|---|---|
| Anthropic | 1.25x input | 0.1x input | 5 min (reset on hit) | 1,024 |
| OpenAI | auto (free) | ~0.1x input | 5-10 min | varies |
| Google | varies | 0.1x input | varies | varies |

### 3.3. GPU pricing (SNAPSHOT: March 2026)

Из Block 07, секции 01, 08:

| GPU | VRAM | Hyperscaler $/hr | Specialized $/hr | Throughput (8B) |
|---|---|---|---|---|
| L4 | 24GB | $0.90-1.10 | $0.50-0.85 | ~40-50 req/s |
| A10G | 24GB | $1.00-1.20 | $0.60-0.80 | ~35-45 req/s |
| A100 | 80GB | $2.50-3.50 | $1.50-2.00 | ~80-120 req/s |
| H100 | 80GB | $3.50-4.50 | $1.50-2.70 | ~150+ req/s |

### 3.4. UX latency thresholds (HEURISTIC)

Из Block 04, секция 04:

| Threshold | Perception | Product Fit |
|---|---|---|
| < 200ms | Instant | Autocomplete, edge models, cache hits |
| < 1s | Comfortable | P95 target for user-facing apps |
| 1-3s | Tolerable | Complex reasoning, with streaming |
| > 3s | Abandonment | Conversion drops, tab-switching |

### 3.5. Model latency benchmarks (SNAPSHOT: March 2026)

Из Block 04, секция 03:

| Metric | Sonnet 4.6 | Haiku 4.5 |
|---|---|---|
| TTFT | ~1.2s | ~0.6s |
| TPS | ~45 | ~135 |
| ITL | ~22ms | ~7.4ms |

### 3.6. Margin thresholds (HEURISTIC)

Из Block 06, секция 10:

| Gross Margin | Zone | Action |
|---|---|---|
| > 70% | Healthy | Invest in features |
| 60-70% | Monitor | Weekly cost review |
| 50-60% | Action needed | Optimize or re-price |
| < 50% | Critical | Immediate intervention |

### 3.7. Rate limit tiers (VENDOR, SNAPSHOT: March 2026)

Из Block 07, секция 04:

| Tier | Deposit | RPM (Sonnet) | ITPM | OTPM |
|---|---|---|---|---|
| 1 | $5 | 50 | 40K | 8K |
| 2 | $40 | 1,000 | 80K | 16K |
| 3 | $200 | 2,000 | 160K | 32K |
| 4 | $400 | 4,000 | 2M | 400K |

### 3.8. Прочие константы

- Embedding cost: $0.02/MTok (text-embedding-3-small), секция 03 Block 02
- Semantic cache hit latency: 5-20ms, Block 02 секция 03
- Exact match cache hit rate: ~18%, semantic (0.8 threshold): ~67%, Block 02 секция 03
- Agent context growth: non-linear, ~2K tokens per step (baseline), Block 05
- Infrastructure overhead on top of inference: 15-25%, Block 05 секция 07
- Output/input price ratio: median 4-5x, Block 01 секция 02

---

## 4. UX/UI концепция

### 4.1. Общая структура

**Layout:** sidebar navigation + main content area.

- Sidebar: список из 14 модулей, сгруппированных по блокам study guide:
  - Cost Basics (2.1 Token Cost)
  - Optimization (2.2 Optimization Stack)
  - Model Selection (2.3 Scorer, 2.4 Cascade Routing, 2.5 Quality-Cost Boundary)
  - Latency (2.6 Budget Builder)
  - Agents (2.7 Agent Cost, 2.8 Cost Explosion)
  - Unit Economics (2.9 Dashboard, 2.10 Pricing Simulator)
  - Infrastructure (2.11 Breakeven, 2.12 Capacity Planning)
  - PM Tools (2.13 Economics Brief, 2.14 Weekly Review)
- Каждый модуль открывается на отдельной странице.
- Между модулями: кнопки "Use this output in..." со стрелками, показывающие куда передаются данные.

### 4.2. Визуальный стиль

**Темная тема** (как в study guide). Цветовая палитра:
- Background: #0F0F0F (primary), #1A1A1A (cards)
- Text: #E5E5E5 (primary), #999999 (secondary)
- Accent: #4F7FFF (primary actions), #22C55E (savings / positive), #EF4444 (warnings / negative), #F59E0B (caution)
- Cards с subtle border: 1px solid #2A2A2A
- Шрифт: монопространственный для чисел (JetBrains Mono или аналог), sans-serif для текста (Inter)

### 4.3. Паттерны интерфейса

- **Input panels:** левая колонка (или верхняя секция), все вводы с defaults, ползунки для процентов, dropdowns для выбора моделей
- **Output panels:** правая колонка (или нижняя секция), мгновенный пересчет при изменении input (reactive)
- **Tooltips:** при наведении на формулу или термин, popup с объяснением и ссылкой на секцию study guide
- **Presets:** для каждого модуля, кнопка "Load Kairos example" заполняет поля значениями из case study
- **Export:** каждый модуль экспортируется как PNG (для вставки в презентации) или JSON (для шейринга состояния)
- **Data flow indicators:** на sidebar, иконки-стрелки между модулями, показывающие что output 2.1 питает input 2.2 и т.д.

### 4.4. Визуализации

Типы графиков:
- **Waterfall chart** (модуль 2.2: optimization cascade, модуль 2.5: savings vs downstream)
- **Scatter plot** (модуль 2.3: quality-cost frontier)
- **Stacked bar** (модуль 2.4: cost by tier, модуль 2.9: COGS breakdown)
- **Line chart** (модуль 2.12: scenarios over time)
- **Histogram** (модуль 2.9: user cost distribution)
- **Gauge** (модуль 2.6: latency vs threshold, модуль 2.9: margin zone)
- **Crossover chart** (модуль 2.11: API vs self-hosted breakeven)
- **Area chart** (модуль 2.7: context growth)
- **Radar chart** (модуль 2.3: model comparison)
- **Funnel** (модуль 2.4: traffic routing)

Библиотека графиков: Recharts (React) или D3.js. Интерактивные: hover, zoom, highlight.

---

## 5. Технические требования

### 5.1. Стек

- **Frontend:** Next.js 14+ (App Router, server components где нужно, но калькулятор преимущественно client-side)
- **UI framework:** Tailwind CSS + shadcn/ui (темная тема из коробки)
- **Charts:** Recharts (React-native, проще интеграция) + D3.js для кастомных визуализаций (waterfall, crossover)
- **State management:** Zustand (легкий, достаточный для межмодульных данных)
- **Формулы:** чистый TypeScript, вынесены в /lib/calculations/ — один файл на модуль
- **Валидация:** Zod (schema validation для inputs)
- **Export:** html2canvas (PNG), native JSON.stringify (JSON state)

### 5.2. Архитектура

```
/app
  /calculator
    /token-cost           → модуль 2.1
    /optimization-stack   → модуль 2.2
    /model-scorer         → модуль 2.3
    /cascade-routing      → модуль 2.4
    /quality-cost         → модуль 2.5
    /latency-budget       → модуль 2.6
    /agent-cost           → модуль 2.7
    /cost-explosion       → модуль 2.8
    /unit-economics       → модуль 2.9
    /pricing-simulator    → модуль 2.10
    /infra-breakeven      → модуль 2.11
    /capacity-planning    → модуль 2.12
    /economics-brief      → модуль 2.13
    /weekly-review        → модуль 2.14
    layout.tsx            → sidebar navigation
/lib
  /calculations           → формулы (чистые функции, без side effects)
  /data                   → справочники (models.ts, gpus.ts, thresholds.ts)
  /store                  → Zustand stores (shared state между модулями)
  /types                  → TypeScript types
/components
  /charts                 → chart components
  /inputs                 → reusable input components (sliders, dropdowns, etc.)
  /outputs                → reusable output components (tables, cards, etc.)
```

### 5.3. Хостинг

- **Primary:** Vercel (zero-config для Next.js, global CDN, free tier покрывает трафик калькулятора)
- **Alternative:** Cloudflare Pages, Netlify
- **Нет backend:** все расчеты client-side, нет базы данных, нет auth
- **State persistence:** localStorage (автосохранение текущих вводов, восстановление при возврате)
- **Shareable state:** URL с encoded state (query params или hash) для шейринга конфигураций

### 5.4. Зависимости (минимальный набор)

```json
{
  "next": "^14",
  "react": "^18",
  "tailwindcss": "^3",
  "recharts": "^2",
  "zustand": "^4",
  "zod": "^3",
  "html2canvas": "^1",
  "@radix-ui/react-*": "для shadcn/ui компонентов",
  "lucide-react": "иконки"
}
```

Нет серверных зависимостей. Нет API-ключей. Нет баз данных.

---

## 6. Связи между модулями (Data Flow)

Ключевая связь: данные текут слева направо (от простого к сложному), как в study guide.

```
[2.1 Token Cost]
  → cost_per_request, input/output tokens
  ↓
[2.2 Optimization Stack]
  → optimized_cost_per_request, savings %
  ↓
[2.3 Model Scorer] ←→ [2.4 Cascade Routing]
  → best model per task       → blended_cost, traffic split
  ↓                            ↓
[2.5 Quality-Cost Boundary]
  → accept/reject decision per tier switch
  ↓
[2.6 Latency Budget]
  → perceived TTFT, UX classification
  ↓
[2.7 Agent Cost Estimator]
  → cost_per_intent, cost_per_outcome
  ↓
[2.8 Cost Explosion]
  → budget cap recommendations, risk-adjusted cost
  ↓
[2.9 Unit Economics Dashboard]
  → COGS, margin, user distribution
  ↓
[2.10 Pricing Simulator]
  → margin per pricing model
  ↓
[2.11 Infra Breakeven]
  → self-host vs API decision per tier
  ↓
[2.12 Capacity Planning]
  → 3-scenario projection
  ↓
[2.13 Economics Brief] ← собирает данные из всех модулей
[2.14 Weekly Review]   ← шаблон, заполняется вручную
```

**Конкретные связи данных:**

| From | To | Data |
|---|---|---|
| 2.1 Token Cost | 2.2 Optimization Stack | baseline cost/request, input_tokens, output_tokens, model |
| 2.1 Token Cost | 2.4 Cascade Routing | cost per request per model |
| 2.2 Optimization | 2.4 Cascade Routing | optimized cost per request |
| 2.2 Optimization | 2.9 Unit Economics | optimized cost for COGS |
| 2.3 Model Scorer | 2.4 Cascade Routing | recommended model per task |
| 2.4 Cascade Routing | 2.5 Quality-Cost | per-tier cost and quality |
| 2.4 Cascade Routing | 2.7 Agent Cost | model per step in chain |
| 2.1 Token Cost | 2.6 Latency Budget | model TTFT, ITL, output tokens |
| 2.7 Agent Cost | 2.8 Cost Explosion | baseline cost per intent |
| 2.7 Agent Cost | 2.9 Unit Economics | cost per ticket (agentic) |
| 2.8 Cost Explosion | 2.9 Unit Economics | risk-adjusted monthly COGS |
| 2.9 Unit Economics | 2.10 Pricing Simulator | COGS per user, user distribution |
| 2.9 Unit Economics | 2.11 Infra Breakeven | monthly API spend per tier |
| 2.11 Infra Breakeven | 2.12 Capacity Planning | hybrid TCO |
| All modules | 2.13 Economics Brief | summary data for template |

**Механика связей в UI:**
- Каждый модуль имеет секцию "Inputs from other modules" с кнопкой "Pull from [Module Name]"
- Пользователь может переопределить любое значение вручную (override)
- При изменении upstream модуля, downstream модули показывают badge "Source data changed, click to update"

---

## 7. MVP scope

### Первая версия (MVP)

**Включено (6 модулей):**

1. **2.1 Token Cost Calculator** — базовый, необходим всем остальным
2. **2.2 Optimization Stack Simulator** — ключевая ценность, waterfall visualization
3. **2.4 Cascade Routing Calculator** — наглядный результат роутинга
4. **2.7 Agent Cost Estimator** — критично для агентных продуктов
5. **2.9 Unit Economics Dashboard** — итоговый P&L
6. **2.13 Pre-Launch Economics Brief** — практический output

**MVP дает:** сквозной путь от "сколько стоит один запрос" до "какая у меня маржа" и "что написать в Economics Brief перед запуском".

**Справочники в MVP:** цены моделей (3.1), UX thresholds (3.4), margin zones (3.6). Остальные справочники добавляются с соответствующими модулями.

**MVP не включает:**
- 2.3 Model Selection Scorer (V2: добавить к routing)
- 2.5 Quality-Cost Boundary (V2: добавить к routing)
- 2.6 Latency Budget Builder (V2: отдельный релиз)
- 2.8 Cost Explosion Risk (V2: вместе с agent cost)
- 2.10 Pricing Simulator (V2: вместе с unit economics)
- 2.11 Infrastructure Breakeven (V3: для зрелых пользователей)
- 2.12 Capacity Planning (V3: для зрелых пользователей)
- 2.14 Weekly Review Template (V3: PM tools pack)

### Критерии готовности MVP

- Все 6 модулей работают client-side, мгновенный пересчет
- Kairos preset загружается одной кнопкой и демонстрирует полный путь
- Dark theme, responsive (desktop-first, минимальная мобильная адаптация)
- Export: PNG для графиков, copyable text для Economics Brief
- Data flow между модулями работает (pull from upstream)
- Все справочные данные помечены SNAPSHOT с датой
- Zero backend: deploy на Vercel из GitHub repo

### Порядок разработки

1. `/lib/calculations/` — все формулы как чистые функции с unit tests
2. `/lib/data/` — справочники
3. Модуль 2.1 (Token Cost) — фундамент
4. Модуль 2.2 (Optimization Stack) — зависит от 2.1
5. Модуль 2.4 (Cascade Routing) — зависит от 2.1
6. Модуль 2.7 (Agent Cost) — зависит от 2.1
7. Модуль 2.9 (Unit Economics) — зависит от 2.7
8. Модуль 2.13 (Economics Brief) — собирает данные из всех
9. Layout, navigation, data flow between modules
10. Charts, export, polish

Ожидаемый срок MVP: 3-4 недели для одного фронтенд-разработчика.
