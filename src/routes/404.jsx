// import { useRouteError } from "react-router-dom";

export default function ErrorPage() {
    // const error = useRouteError();
    // console.error(error);

    return (
        <div className="text-center flex h-screen" id="error-page">
            <div className="m-auto">
                <h1 className="text-3xl font-bold">Sorryjako!</h1>
                <p>Sorryjako, an unexpected error has occurred.</p>
                {/* <p>
                    <i>{error.statusText || error.message}</i>
                </p> */}
            </div>
        </div>
    );
}
