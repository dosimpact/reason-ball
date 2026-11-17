import { createLibrary, type PromptOptions } from "@openuidev/react-lang";
import { financialSeriesPromptExamples } from "./components/financial/series-chart-examples";
import { financialPromptExamples } from "./components/financial/prompt-examples";
import { canvasItemPromptExamples } from "./components/canvas-item/prompt-examples";
import { actions } from "./actions";
import { functions } from "./functions";
import "./components/theme.css";
import "./components/components.css";
import "./components/map/map.css";
import { QueryPanel } from "./components/financial/query-panel";
import { CanvasItem } from "./components/canvas-item/canvas-item";
import { FinancialSeriesChart } from "./components/financial/series-chart/financial-series-chart";
import { IndicatorControls } from "./components/financial/indicator-controls";
import { FinancialChart, FinancialChartPlot, FinancialChartSummary, FinancialChartMetadata } from "./components/financial/financial-chart";
import { Chart } from "./components/chart";
import { Carousel, Celebration, Code, Flashcard, MathBlock, Popover, Quote, YouTube } from "./components/extra";
import {
  Button,
  Checkbox,
  DatePicker,
  IconButton,
  Input,
  Pressable,
  RadioGroup,
  SegmentedControl,
  Select,
  Slider,
  TextArea,
  Timer,
} from "./components/controls";
import { HtmlView } from "./components/html-view";
import { Box, Card, Col, Divider, Form, Grid, Row, Spacer } from "./components/layout";
import { MapMarker, MapView } from "./components/map/map";
import { Icon, Image, SearchImage } from "./components/media";
import { svgComponents } from "./components/svg";
import { Table } from "./components/table";
import { Badge, Caption, Label, Link, List, ListItem, Markdown, Text, Title } from "./components/text";

/**
 * Primitives the model arranges itself, plus a few widgets for what a model
 * cannot draw (a street map, a sandboxed HTML page). Layout is never fixed here.
 * Generic @functions let a page compute with its own state, so an answer can be
 * a working tool rather than a form sent back to the assistant.
 */
export const library = createLibrary({
  root: "Col",
  components: [
    Col, Row, Box, Grid, Card, Carousel, Popover, Divider, Spacer, CanvasItem,
    Title, Text, Caption, Label, Badge, Link, List, ListItem, Markdown, Quote, Code, MathBlock,
    Button, IconButton, Pressable, Input, TextArea, Select, SegmentedControl, Slider, Checkbox, RadioGroup, DatePicker, Timer, Form,
    SearchImage, Image, Icon, Table, Chart, FinancialSeriesChart, FinancialChart, FinancialChartPlot, FinancialChartSummary, FinancialChartMetadata, IndicatorControls, QueryPanel, MapView, MapMarker, YouTube,
    Flashcard, Celebration,
    ...svgComponents, HtmlView,
  ],
  functions,
  actions,
  componentGroups: [
    {
      name: "Layout",
      components: ["Col", "Row", "Box", "Grid", "Card", "Carousel", "Popover", "Divider", "Spacer", "CanvasItem"],
      notes: [
        '- gap and padding count 4px steps. Length is px or a CSS length like "50%". Radius is "sm", "md", "lg", "xl", "full" or px.',
        '- Color is "ink", "muted", "faint", "surface", "info", "success", "warning", "danger", "purple", "pink", "chart1" to "chart6", or a CSS color. As a background, status colors are soft tints.',
      ],
    },
    { name: "Text", components: ["Title", "Text", "Caption", "Label", "Badge", "Link", "List", "ListItem", "Markdown", "Quote", "Code", "Math"] },
    {
      name: "Inputs",
      components: ["Button", "IconButton", "Pressable", "Input", "TextArea", "Select", "SegmentedControl", "Slider", "Checkbox", "RadioGroup", "DatePicker", "Timer", "Form"],
      notes: [
        "- An input's first argument is its value, usually a $variable that other statements read.",
        '- Every input either changes something shown on the page, or sits in a Form whose submit Button sends a short first-person @ToAssistant ("Help me choose a bike"); the form values go with it. No dead inputs.',
      ],
    },
    { name: "Media and data", components: ["SearchImage", "Image", "Icon", "Table", "Chart", "FinancialSeriesChart", "FinancialChart", "FinancialChartPlot", "FinancialChartSummary", "FinancialChartMetadata", "IndicatorControls", "QueryPanel", "Map", "MapMarker", "YouTube"], notes: [
      '- FinancialSeriesChart(config) renders supplied time series without a market-data request: series[].type is candlestick, line, area, baseline or histogram. Candlestick needs OHLC; other types only need time/value and can show indicators without price bars. Compose multiple series; priceScaleId left/right gives independent scales, not a sixth series type. Attach markers and priceLines to each series. Use actual supplied values, units, events and thresholds; never invent market data or buy/sell signals. Keep trusted TA snapshots in FinancialChart/FinancialChartPlot rather than copying large arrays into DSL.',
      '- FinancialChart consumes one trusted snapshot. Fetch it with data = Query("technical_analysis_chart", {ticker: $ticker, interval: $interval, count: $count, indicators: "SMA,RSI,MACD"}, {bars: [], status: "loading"}). The Host runs this allowlisted read tool without an LLM round trip.',
      '- For v2 multi-instance indicators use catalog = Query("technical_analysis_catalog", {}, null), IndicatorControls($chart_instances, catalog), and chart = Query("technical_analysis_chart", {ticker: $ticker, interval: $interval, count: $count, schema_version: 2, instances: $chart_instances}, {bars: [], status: "loading"}). Use catalog metadata, never invented parameter names or numeric arrays.',
      '- Put Query-backed data components and their editable argument controls inside QueryPanel([data components], Action([@Run(queryStatement)]), [editable controls]); every Query view must provide its own manual refresh icon and labelled argument fields together.',
      '- Query(tool, args, default, seconds) re-runs when reactive args change. Omit seconds or use 0 for historical answers. Explicit live mode may use 30 seconds only for the active latest answer. Price and all indicators must come from the same returned snapshot.',
    ] },
    { name: "Play", components: ["Flashcard", "Celebration"] },
    { name: "Drawing", components: ["Svg", "G", "Circle", "Ellipse", "Rect", "Line", "Path", "Polyline", "Polygon", "SvgText", "HtmlView"] },
  ],
});

// SEC answers use server-validated findings; this exact catalog also validates the response.

/** openui generate discovers this export and passes it to library.prompt(). */
export const promptOptions: PromptOptions = {
  toolCalls: true,
  bindings: true,
  examples: [...financialSeriesPromptExamples, ...financialPromptExamples, ...canvasItemPromptExamples],
  additionalRules: [
    "Basic controls and data surfaces use the Host shadcn UI primitives. Keep the existing OpenUI names and arguments: Button and IconButton support canonical shadcn variants default/secondary/destructive/outline/ghost/link; solid/soft and size md remain backward-compatible aliases. Badge accepts an optional fourth canonical variant argument, which takes precedence over semantic color. SegmentedControl uses a single-selection ToggleGroup and keeps a nonempty selected value. Card composes CardContent, Popover uses the shadcn trigger composition, and Code uses CodeBlock. Do not emit shadcn React imports, JSX, raw class names, or invent new OpenUI components. Continue using reactive fields, actions and Form bindings as declared in this catalog.",
    "QueryPanel(dataChildren, refreshAction, controls) shows data continuously and hides controls in a closed disclosure by default. Put Input, Select and IndicatorControls in its third argument; keep FinancialChart or FinancialChartPlot in its first. FinancialChart is a compact composite. Use FinancialChartPlot(snapshot), FinancialChartSummary(snapshot) and FinancialChartMetadata(snapshot) separately when a custom arrangement helps; give Plot and Summary the same unique visibilityKey second argument to link their local display toggles; do not repeat the composite and its blocks for the same data.",
    "Examples illustrate syntax, not required layouts or evidence. Replace sample identifiers, dates, tickers and numbers with supplied data. Choose the components and layout appropriate to the question.",
    "For technical analysis use Query-backed FinancialChart with the supplied request; do not invent OHLCV or indicator arrays. Keep each Query, labelled controls and manual refresh together in QueryPanel. Preserve the requested instance IDs and parameters.",
    "Only in Canvas mode wrap each supplied canvasItems entry with CanvasItem using its exact ID. Use separate reactive variables and Query statements per item so pinned elements remain independent. Do not invent IDs or wrap the complete response as one item.",
    "For TA-Lib use supplied bounded output points, dates, nulls, units, errors and warnings. Pattern codes are not probabilities. A UI example never supplies real market evidence.",
  ],
};
