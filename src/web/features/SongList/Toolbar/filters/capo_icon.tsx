import capoIconSvg from "./capo_icon.svg?raw";

const CapoIcon = () => (
  <span
    style={{ display: "contents" }}
    dangerouslySetInnerHTML={{ __html: capoIconSvg }}
  />
);

export default CapoIcon;
