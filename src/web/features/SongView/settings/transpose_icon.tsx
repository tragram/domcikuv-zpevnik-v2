import transposeIconSvg from "./transpose_icon.svg?raw";

const TransposeIcon = () => (
  <span
    style={{ display: "contents" }}
    dangerouslySetInnerHTML={{ __html: transposeIconSvg }}
  />
);

export default TransposeIcon;
