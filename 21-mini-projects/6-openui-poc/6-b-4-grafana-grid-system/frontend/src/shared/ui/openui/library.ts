import { withRepeatedSourceSupport } from "./source-card";
import { defineComponent } from "@openuidev/react-lang";
import { actions } from "./actions";
import { functions } from "./functions/index";
import "./components/theme.css";
import "./components/components.css";
import "./components/map/map.css";
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
import { Box, Card, Col, Form, Grid, Row, Spacer } from "./components/layout";
import { MapMarker, MapView } from "./components/map/map";
import { Icon, Image, SearchImage } from "./components/media";
import { svgComponents } from "./components/svg";
import { Table } from "./components/table";
import { Badge, Caption, Link, List, ListItem, Markdown, Text, Title } from "./components/text";

import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";

// 6-2 contracts always win. Only genuinely different 6-3 contracts get a new name.
const intelligentComponents: (typeof openuiChatLibrary.components)[string][] = [
  Col, Row, Box, Grid, Card, Carousel, Popover, Spacer,
  Title, Text, Caption, Badge, Link, List, ListItem, Markdown, Quote, Code, MathBlock,
  Button, IconButton, Pressable, Input, TextArea, Select, SegmentedControl, Slider,
  Checkbox, RadioGroup, DatePicker, Timer, Form, SearchImage, Image, Icon, Table,
  Chart, MapView, MapMarker, YouTube, Flashcard, Celebration, ...svgComponents, HtmlView,
];
export const componentRenames = Object.fromEntries(intelligentComponents
  .filter(c => c.name in openuiChatLibrary.components)
  .map(c => [c.name, c.name === "Col" ? "VStack" : `Iui${c.name}`]));
export const functionRenames = Object.fromEntries(functions
  .filter(fn => fn.name in openuiChatLibrary.components)
  .map(fn => [fn.name, `Iui${fn.name}`]));
export const discardedComponents = { Label: "Label", Divider: "Separator" };
const additions = intelligentComponents.map(component => {
  const name = componentRenames[component.name];
  // Clone schemas so registering aliases cannot retag the original definition.
  return name ? defineComponent({ ...component, name, props: component.props.clone() }) : component;
});
// Extend Card's accepted children without removing any original child or changing its renderer.
const extendedLibrary = openuiChatLibrary.extend({
  components: { add: additions.map(component => ({ component, slots: ["Card.children"] })) },
  functions: { add: functions.map(fn => ({ ...fn, name: functionRenames[fn.name] ?? fn.name })) },
  actions: { add: actions },
});

export const library = extendedLibrary.extend({
  components: { override: [withRepeatedSourceSupport(extendedLibrary.components.Card)] },
});
