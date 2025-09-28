export default function Card({ children, className = "", ...props }) {
  return (
    <div className={`bg-white shadow rounded-lg p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children, className = "" }) {
  return <div className={`border-b pb-4 mb-4 ${className}`}>{children}</div>;
};

Card.Body = function CardBody({ children, className = "" }) {
  return <div className={className}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = "" }) {
  return <div className={`border-t pt-4 mt-4 ${className}`}>{children}</div>;
};
