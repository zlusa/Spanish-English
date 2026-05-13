import { MicSecureContextBanner } from "./components/MicSecureContextBanner"
import { TrainingRoom } from "./components/TrainingRoom"

export function App() {
  return (
    <div className="wrap">
      <MicSecureContextBanner />
      <TrainingRoom />
    </div>
  )
}
