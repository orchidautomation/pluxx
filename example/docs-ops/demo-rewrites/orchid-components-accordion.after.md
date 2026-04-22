# Accordions

> Source page: `https://orchid-docs.docsalot.dev/components/accordion`
> Path: `components/accordion`
> Mode: read-only rewrite proposal for the flagship `docs-ops` proof

Use `Accordion` when you want to hide optional detail behind a short, scannable preview.

It works well for:

- FAQ answers
- secondary implementation notes
- setup caveats that should stay available without crowding the page

If you need several related items in one block, use [AccordionGroup](/components/accordion-group) to display multiple accordions together.

You can place text, code blocks, and other components inside the accordion body.

## Example

<Accordion
  title="Do I need an API key?"
  description="Public Docsalot MCP reads work without one."
  icon="circle-question"
  iconType="regular"
>
  No for the public read-only MCP surface. Connect to the hosted MCP endpoint at
  `https://{subdomain}-docs.docsalot.dev/api/mcp` and use the exposed read tools
  to inspect or search the docs. If you want a true write or publish flow, use a
  separate authenticated authoring path.
</Accordion>

<RequestExample>
  ```jsx Accordion Example
  <Accordion
    title="Do I need an API key?"
    description="Public Docsalot MCP reads work without one."
    icon="circle-question"
    iconType="regular"
  >
    No for the public read-only MCP surface. Connect to the hosted MCP endpoint at
    `https://{subdomain}-docs.docsalot.dev/api/mcp` and use the exposed read tools
    to inspect or search the docs. If you want a true write or publish flow, use a
    separate authenticated authoring path.
  </Accordion>
  ```
</RequestExample>

## When To Use Accordion vs AccordionGroup

- Use `Accordion` for one expandable item on a page.
- Use [AccordionGroup](/components/accordion-group) when you have multiple related items, such as FAQs or troubleshooting entries.

## Best Practices

- Keep the `title` short and specific so readers can scan it quickly.
- Use `description` when the extra line helps readers decide whether to expand the content.
- Use `defaultOpen` only when the page is easier to understand with the content already visible.
- Use `icon` sparingly to reinforce the type of content rather than decorate every item.
- Do not hide required setup steps or critical warnings inside a collapsed section unless the surrounding page makes that content easy to find.

## Props

<ResponseField name="title" type="string" required>
  The text shown in the collapsed preview row. Keep it short and easy to scan.
</ResponseField>

<ResponseField name="description" type="string">
  Optional supporting text below the title. Use it when the preview needs a little more context.
</ResponseField>

<ResponseField name="defaultOpen" type="boolean" default="false">
  Opens the accordion by default on first render.
</ResponseField>

<ResponseField name="icon" type="string or svg">
  A [Font Awesome icon](https://fontawesome.com/icons) name or SVG code passed into `icon={}`.
</ResponseField>

<ResponseField name="iconType" type="string">
  Optional icon style. Supported values are `regular`, `solid`, `light`, `thin`, `sharp-solid`, `duotone`, and `brands`.
</ResponseField>
