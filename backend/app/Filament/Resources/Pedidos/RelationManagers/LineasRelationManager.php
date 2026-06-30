<?php

namespace App\Filament\Resources\Pedidos\RelationManagers;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\Summarizers\Summarizer;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class LineasRelationManager extends RelationManager
{
    protected static string $relationship = 'lineas';

    protected static ?string $title = 'Líneas del pedido';

    protected static bool $isLazy = false;

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('producto_id')
                    ->label('Producto')
                    ->relationship('producto', 'nombre')
                    ->required(),
                TextInput::make('cantidad')
                    ->numeric()
                    ->minValue(0)
                    ->required(),
                TextInput::make('precio_unitario')
                    ->label('Precio unitario (L)')
                    ->numeric()
                    ->minValue(0)
                    ->required(),
                TextInput::make('devolucion_anterior')
                    ->label('Devolución anterior')
                    ->numeric()
                    ->minValue(0)
                    ->default(0)
                    ->required(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->deferLoading(false)
            ->columns([
                TextColumn::make('producto.nombre')
                    ->label('Producto'),
                TextColumn::make('cantidad')
                    ->numeric(),
                TextColumn::make('precio_unitario')
                    ->label('Precio (L)')
                    ->numeric(decimalPlaces: 2),
                TextColumn::make('devolucion_anterior')
                    ->label('Devolución'),
                TextColumn::make('subtotal')
                    ->label('Subtotal (L)')
                    ->state(fn ($record) => number_format(
                        ($record->cantidad - $record->devolucion_anterior) * $record->precio_unitario,
                        2,
                    ))
                    ->summarize(
                        Summarizer::make()
                            ->label('Total')
                            ->using(fn (Builder $query) => 'L ' . number_format(
                                (float) $query->sum(DB::raw('(cantidad - devolucion_anterior) * precio_unitario')),
                                2,
                            )),
                    ),
            ])
            ->paginated(false)
            ->headerActions([
                CreateAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
