import googleIconSvg from "./google_icon.svg?raw";

const GoogleIcon = () => (
  <span
    style={{ display: "contents" }}
    dangerouslySetInnerHTML={{ __html: googleIconSvg }}
  />
);

export default GoogleIcon;
