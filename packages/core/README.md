# slopdogs/core

Kernpaket für das SlopDogs-System - enthält die grundlegenden Komponenten für die Orchestrierung und Ausführung von Data-Processing-Einheiten (Dogs).

## Installation

Dieses Paket wird als lokale Dependency im gleichen Repo verwendet:

```json
{
  "dependencies": {
    "slopdogs": "file:./packages/core"
  }
}
```

Nach dem Hinzufügen: `npm install` ausführen, um das lokale Paket zu verlinken.

## Komponenten

### Core Entities
- `IHuntingDog` - Interface für alle Dogs
- `Dog` - Abstrakte Basisklasse für Dogs
- `IHuntingSeason` - Interface für die Season/Wave-Logik

### Run Orchestration
- `KennelRun` - Klasse für Kennel-Runs
- `SeasonRunner` - Klasse für Wave-Ausführung
- `IKennelConfig` - Interface für Kennel-Konfigurationen

### SerializedDog
- `SerializedDog` - Dynamische Code-Ausführung in VM

## Verwendung

```typescript
import { 
  KennelRun, 
  IKennelConfig,
  SeasonRunner,
  SerializedDog,
  Dog,
  IHuntingDog,
  IHuntingSeason
} from 'slopdogs';
```

## Eigene Dogs erstellen

```typescript
import { Dog, IHuntingSeason } from 'slopdogs';

class MyCustomDog extends Dog<MyDataType> {
  // Überschreibe name von Dog
  get name(): string {
    return 'MyCustomDog';
  }
  
  // Überschreibe required von Dog - definiert welche Dogs als required Parents benötigt werden
  get required() {
    return []; // Array von Dog-Klassen, die als required Parents benötigt werden
  }
  
  // Überschreibe optional von Dog - definiert welche Dogs als optional Parents verwendet werden können
  get optional() {
    return []; // Array von Dog-Klassen, die als optional Parents verwendet werden können
  }
  
  // Überschreibe yieldCollectorFactory von Dog - MUSS den Typ des Hundes (MyDataType) zurückgeben
  protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<MyDataType> => {
    // Deine Logik hier
    // WICHTIG: Der Rückgabetyp muss MyDataType sein (der generische Typ des Dogs)
    return await fetch('https://api.example.com/data').then(r => r.json());
  };
}
```

## SerializedDog Factory

```typescript
import { SerializedDog } from 'slopdogs';

const serializedDogFactory = async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
  // Lade SerializedDog-Configs aus deiner Datenquelle
  const configs = await loadConfigs(ids);
  return configs.map(config => new SerializedDog(config, config.id));
};
```

## Abhängigkeiten

- `vm2` - Für SerializedDog VM-Ausführung
- `@types/node` - TypeScript-Typen

## Lizenz

[MIT](../../LICENSE) — Copyright (c) 2026 Martin.
