import type { MonitoredPerson, Timestamp } from "../../domain.js";

export class UnsortedTimestampsError extends Error {
  readonly previousTimestamp: Timestamp;
  readonly currentTimestamp: Timestamp;
  readonly recordNumber: number;

  constructor(previousTimestamp: Timestamp, currentTimestamp: Timestamp, recordNumber: number) {
    super(
      `Timestamps must be in ascending order: "${currentTimestamp}" follows "${previousTimestamp}" at record ${recordNumber}`,
    );
    this.name = "UnsortedTimestampsError";
    this.previousTimestamp = previousTimestamp;
    this.currentTimestamp = currentTimestamp;
    this.recordNumber = recordNumber;
  }
}

// Se a ordem falhar, o consumidor deve descartar os grupos emitidos antes do erro.
export const groupSortedByTimestamp = async function* groupSortedByTimestamp(
  people: AsyncIterable<MonitoredPerson> | Iterable<MonitoredPerson>,
): AsyncGenerator<[Timestamp, MonitoredPerson[]]> {
  let currentTimestamp: Timestamp | undefined;
  let previousTimestamp: Timestamp | undefined;
  let currentGroup: MonitoredPerson[] = [];
  let recordNumber = 0;

  for await (const person of people) {
    recordNumber += 1;
    // O formato YYYY-MM-DD HH:mm:ss permite comparar timestamps diretamente como texto.
    if (previousTimestamp !== undefined && person.timestamp < previousTimestamp) {
      throw new UnsortedTimestampsError(previousTimestamp, person.timestamp, recordNumber);
    }

    if (currentTimestamp !== undefined && person.timestamp !== currentTimestamp) {
      yield [currentTimestamp, currentGroup];
      currentGroup = [];
    }

    currentTimestamp = person.timestamp;
    previousTimestamp = person.timestamp;
    currentGroup.push(person);
  }

  if (currentTimestamp !== undefined) {
    yield [currentTimestamp, currentGroup];
  }
};

// Esta alternativa simples guarda todos os registros; use-a apenas em entradas pequenas.
export const groupUnsortedByTimestamp = async (
  people: AsyncIterable<MonitoredPerson> | Iterable<MonitoredPerson>,
): Promise<Map<Timestamp, MonitoredPerson[]>> => {
  const groups = new Map<Timestamp, MonitoredPerson[]>();

  for await (const person of people) {
    const group = groups.get(person.timestamp);
    if (group) {
      group.push(person);
    } else {
      groups.set(person.timestamp, [person]);
    }
  }

  return groups;
};
