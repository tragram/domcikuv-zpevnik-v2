import smartColumnsIconSvg from "./smart_columns_icon.svg?raw";

const SmartColumnsIcon = () => (
  <span
    style={{ display: "contents" }}
    dangerouslySetInnerHTML={{ __html: smartColumnsIconSvg }}
  />
);

export default SmartColumnsIcon;
