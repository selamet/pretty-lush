// Table rendering for JSON output that is an array of objects.
export default function JsonTable({ rows, keys }) {
  function renderCell(v) {
    if (v === null || v === undefined)
      return <span className="v-null">null</span>;
    if (typeof v === "boolean")
      return <span className="v-bool">{String(v)}</span>;
    if (typeof v === "number")
      return <span className="v-num">{String(v)}</span>;
    if (typeof v === "string") return <span className="v-str">{v}</span>;
    return <span>{JSON.stringify(v)}</span>;
  }

  return (
    <div className="json-table-host">
      <table className="json-table">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k} title={typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}>
                  {renderCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
