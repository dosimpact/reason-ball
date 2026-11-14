/** Complete, deterministic OpenUI programs. Helper definitions are exercised through their parents. */
export type CatalogFixture = {
  id: string;
  title: string;
  library: "shadcn" | "magicui";
  category: string;
  officialSlug?: string;
  components: string[];
  source: string;
};

function fixture(id: string, category: string, components: string[], children: string): CatalogFixture {
  return { id, title: components[0], library: "shadcn", category, components, source: `root = Card([${children}])` };
}

const sampleImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23e2e8f0'/%3E%3C/svg%3E";
export const baseCatalogFixtures: CatalogFixture[] = [
  fixture("content", "Content", ["Card", "CardHeader", "TextContent", "MarkDownRenderer", "Alert", "Badge", "Avatar", "CodeBlock", "Progress", "Separator"], 'CardHeader("Sample content", "Deterministic fixture"), TextContent("Plain text"), MarkDownRenderer("**Markdown** sample"), Alert("Ready", "Sample status", "success"), Badge("Preview"), Avatar("", "Sample avatar", "UI"), CodeBlock("const sample = true", "typescript", "Example"), Progress(65, "Completion"), Separator()'),
  fixture("images", "Content", ["Image", "ImageBlock"], `Image(${JSON.stringify(sampleImage)}, "Sample image"), ImageBlock(${JSON.stringify(sampleImage)}, "Caption image", "Local sample image")`),
  fixture("table", "Tables", ["Table", "Col"], 'Table([Col("Name", "string"), Col("Count", "number")], [["Sample", 12], ["Example", 24]])'),
  ...["BarChart", "LineChart", "AreaChart", "RadarChart"].map(name => fixture(name.toLowerCase(), "Charts", [name, "Series"], `${name}(["Jan", "Feb", "Mar"], [Series("Sample", [10, 20, 15])])`)),
  ...["PieChart", "RadialChart"].map(name => fixture(name.toLowerCase(), "Charts", [name, "Slice"], `${name}([Slice("One", 40), Slice("Two", 60)])`)),
  fixture("scatterchart", "Charts", ["ScatterChart", "ScatterSeries", "Point"], 'ScatterChart([ScatterSeries("Sample", [Point(1, 2, "One"), Point(3, 4, "Two")])])'),
  fixture("form", "Forms", ["Form", "FormControl", "Label", "Input", "TextArea", "Select", "SelectItem", "DatePicker", "Slider", "CheckBoxGroup", "CheckBoxItem", "RadioGroup", "RadioItem", "SwitchGroup", "SwitchItem", "Buttons", "Button"], `DialogBlock("Inspect label", "Form label", "Label example", [Label("Sample form")]), Form("sample", Buttons([Button("Submit sample", {type: "continue_conversation"})]), [FormControl("Email", Input("email", "you@example.com", "email", {required: true, email: true})), FormControl("Message", TextArea("message", "Your message", 3)), FormControl("Plan", Select("plan", [SelectItem("starter", "Starter"), SelectItem("pro", "Pro")], "Choose plan")), FormControl("Date", DatePicker("date", "Pick date")), FormControl("Volume", Slider("volume", 0, 100, 1, 50)), FormControl("Interests", CheckBoxGroup("interests", [CheckBoxItem("design", "Design")])), FormControl("Delivery", RadioGroup("delivery", [RadioItem("email", "Email delivery"), RadioItem("sms", "SMS delivery")])), FormControl("Notifications", SwitchGroup("notifications", [SwitchItem("updates", "Updates")]))])`),
  fixture("followups", "Actions", ["FollowUpBlock", "FollowUpItem"], 'FollowUpBlock([FollowUpItem("Show sample details")])'),
  fixture("tabs", "Layout", ["Tabs", "TabItem"], 'Tabs([TabItem("overview", "Overview", [TextContent("Overview panel")]), TabItem("details", "Details", [TextContent("Details panel")])])'),
  fixture("accordion", "Layout", ["Accordion", "AccordionItem"], 'Accordion([AccordionItem("sample", "Expand sample", [TextContent("Expanded content")])], "single")'),
  fixture("carousel", "Layout", ["Carousel"], 'Carousel([[TextContent("Slide one")], [TextContent("Slide two")]])'),
  fixture("tags", "Content", ["TagBlock", "Tag"], 'TagBlock([Tag("Sample", "outline"), Tag("Preview")])'),
  fixture("typography", "Typography", ["Heading", "Blockquote", "InlineCode"], 'Heading("Sample heading", "h2"), Blockquote("Simple is better.", "Sample author"), InlineCode("pnpm dev")'),
  fixture("pagination", "Navigation", ["PaginationBlock"], 'PaginationBlock(2, 5)'),
  fixture("dialog", "Overlays", ["DialogBlock"], 'DialogBlock("Open sample dialog", "Sample dialog", "Deterministic dialog", [TextContent("Dialog content")])'),
  fixture("alertdialog", "Overlays", ["AlertDialogBlock"], 'AlertDialogBlock("Confirm sample", "Confirm sample action", "This only records a local action.", "Confirm", "Cancel")'),
  fixture("drawer", "Overlays", ["DrawerBlock"], 'DrawerBlock("Open sample drawer", "Sample drawer", "Deterministic drawer", [TextContent("Drawer content")])'),
  fixture("calendar", "Calendar", ["CalendarBlock"], 'CalendarBlock("single", "2026-01-15", 1)'),
];
