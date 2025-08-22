import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      position="top-right"
      expand
      visibleToasts={3}
      closeButton
      {...props}
    />
  )
}

export { Toaster }
